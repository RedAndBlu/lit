import { html, LitElement, customElement, property } from 'lit-element';
import { directive, NodePart, TemplateResult } from 'lit-html';
import { repeat } from 'lit-html/directives/repeat.js';
// import { scroll } from './scroll.js';
import { Type, Layout, LayoutConfig } from './uni-virtualizer/lib/layouts/Layout.js';
import { VirtualScroller, RangeChangeEvent } from './uni-virtualizer/lib/Experimental.js';


/**
 * A LitElement wrapper of the scroll directive.
 *
 * Import this module to declare the lit-virtualizer custom element.
 * Pass an items array, renderItem method, and scroll target as properties
 * to the <lit-virtualizer> element.
 */
@customElement('lit-virtualizer')
export class LitVirtualizer<Item, Child extends HTMLElement> extends LitElement {
    @property()
    private _renderItem: (item: Item, index?: number) => TemplateResult;

    @property()
    private _first: number = 0;

    @property()
    private _last: number = -1;

    @property()
    private _items: Array<Item>;

    private _scroller: VirtualScroller<Item, Child> = null;

    @property()
    scrollTarget: Element | Window = this;

    @property()
    keyFunction: (item:any) => any;

    // @property()
    // private _layout: Layout | Type<Layout> | LayoutConfig

    // private _scrollToIndex: {index: number, position: string};

    constructor() {
        super();
        this._scroller = new VirtualScroller();
        this.addEventListener('rangeChanged', (e: RangeChangeEvent) => {
            this._first = e.first;
            this._last = e.last;
        })
    }
  
    connectedCallback() {
        super.connectedCallback();
        this._scroller.container = this;
        this._scroller.scrollTarget = this.scrollTarget;
    }
  
    disconnectedCallback() {
        super.disconnectedCallback();
        this._scroller.container = null;
    }
  
    createRenderRoot() {
        return this;
    }

    get items() {
        return this._items;
    }

    set items(items) {
        this._items = items;
        this._scroller.totalItems = items.length;
    }

    /**
     * The method used for rendering each item.
     */
    get renderItem() {
        return this._renderItem;
    }
    set renderItem(renderItem) {
        if (renderItem !== this.renderItem) {
            this._renderItem = renderItem;
            this.requestUpdate();
        }
    }

    set layout(layout: Layout | Type<Layout> | LayoutConfig) {
        // TODO (graynorton): Shouldn't have to set this here
        this._scroller.container = this;
        this._scroller.scrollTarget = this.scrollTarget;
        this._scroller.layout = layout;
    }

    get layout() {
        return this._scroller.layout;
    }
    
    
    /**
     * Scroll to the specified index, placing that item at the given position
     * in the scroll view.
     */
    async scrollToIndex(index: number, position: string = 'start') {
        this._scroller.scrollToIndex = {index, position}
        // this._scrollToIndex = {index, position};
        // this.requestUpdate();
        // await this.updateComplete;
        // this._scrollToIndex = null;
    }

    render(): TemplateResult {
        const { items, _first, _last, renderItem, keyFunction } = this;
        const itemsToRender = [];
        for (let i = _first; i < _last + 1; i++) {
            itemsToRender.push(items[i]);
        }
        return html`
            ${repeat(itemsToRender, keyFunction, renderItem)}
        `;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'lit-virtualizer': LitVirtualizer<unknown, HTMLElement>;
    }
}

interface ScrollDirectiveState {
    scroller: VirtualScroller<unknown, HTMLElement>,
    first: number,
    last: number,
    renderItem: (item: any, index?: number) => TemplateResult,
    keyFunction: (item: any) => any,
    items: Array<any>
}

const partToState: WeakMap<NodePart, ScrollDirectiveState> = new WeakMap();

/**
 * Configuration options for the scroll directive.
 */
interface ScrollConfig<Item> {
    /**
     * A function that returns a lit-html TemplateResult. It will be used
     * to generate the DOM for each item in the virtual list.
     */
    renderItem?: (item: Item, index?: number) => TemplateResult;

    keyFunction?: (item:any) => any;
  
    // TODO (graynorton): Document...
    layout?: Layout | Type<Layout> | LayoutConfig;
  
    /**
     * An element that receives scroll events for the virtual scroller.
     */
    scrollTarget?: Element | Window;
  
    /**
     * The list of items to display via the renderItem function.
     */
    items?: Array<Item>;
  
    /**
     * Limit for the number of items to display. Defaults to the length of the
     * items array.
     */
    totalItems?: number;
  
    /**
     * Index and position of the item to scroll to.
     */
    scrollToIndex?: {index: number, position?: string};
  }
  
function renderItems({renderItem, keyFunction, first, last, items}) {
    const itemsToRender = [];
    for (let i = first; i < last + 1; i++) {
        itemsToRender.push(items[i]);
    }
    return repeat(itemsToRender, keyFunction, renderItem);
}

/**
 * A lit-html directive that turns its parent node into a virtual scroller.
 *
 * See ScrollConfig interface for configuration options.
 */
export const scroll: <Item>(config: ScrollConfig<Item>) => (part: NodePart) => Promise<void> = directive(<Item, Child extends HTMLElement>(config: ScrollConfig<Item>) => async (part: NodePart) => {
    // Retain the scroller so that re-rendering the directive's parent won't
    // create another one.
    const { items, renderItem, keyFunction } = config;
    let state = partToState.get(part);
    if (!state) {
      if (!part.startNode.isConnected) {
        await Promise.resolve();
      }
        const container = part.startNode.parentNode as HTMLElement;
        const scrollTarget = config.scrollTarget || container;
        state = {
            scroller: new VirtualScroller<Item, Child>({ container, scrollTarget }),
            first: 0,
            last: -1,
            renderItem,
            keyFunction,
            items
        };
        partToState.set(part, state);
        container.addEventListener('rangeChanged', (e: RangeChangeEvent) => {
            state.first = e.first;
            state.last = e.last;
            part.setValue(renderItems(state));
            part.commit();
        });
    }
    const { scroller } = state;
    Object.assign(state, { items, renderItem, keyFunction });
    if (config.items !== undefined) {
        scroller.items = items;
        scroller.totalItems = config.items.length;
    }
    for (let prop of ['totalItems', 'layout', 'scrollToIndex']) {
        if (config[prop] !== undefined) {
            scroller[prop] = config[prop];
        }
    }
    part.setValue(renderItems(state));
  });
  