import HyperHTMLElement from "hyperhtml-element";
import {Observable, Subject} from "./rx";
import {UI} from "./ui";
import {importStyle} from "./import-styles";

const definitions: Function[] = [];

export function defineComponents() {
    while (definitions.length) {
        definitions.pop()();
    }
}

export function Component(info: {
    name: string,
    observedAttributes?: string[],
    booleanAttributes?: string[],
    template: Function,
    style: string
}) {
    return (target) => {
        let Id = 0;
        importStyle(info.style, target.name);
        const elementConstructor = class extends HyperHTMLElement {
            static observedAttributes = info.observedAttributes || [];
            static booleanAttributes = info.booleanAttributes || [];
            private component: ComponentExtended<any, any>;
            private _id = Id++;
            handlerProxy: any;

            renderState(state) {
                info.template(this.html.bind(this), state, this.handlerProxy);
                this.component.Render$.next();
            }

            created() {
                // const dependencies = Reflector.paramTypes(target).map(type => Container.get(type));
                this.component = UI.container.get(target);//new target(...dependencies);
                // this.component.element = this;
                this.component['id'] = this._id;
                this.handlerProxy = new Proxy({}, {
                    get: (target, key) => {
                        return this.getEventHandler(key);
                    }
                });
                this.component._elementSubject$.next(this);
                this.component.State$.subscribe(state => {
                    this.renderState(state);
                });
                this.component.Actions$.subscribe();
                // this.component.created();
            }

            private eventHandlers = {};
            getEventHandler = type => mapping => {
                const key = `${type}.${mapping}`;
                if (this.eventHandlers[key])
                    return this.eventHandlers[key];
                return (this.eventHandlers[key] = event => {
                    const directHandler = this.component.Events && this.component.Events[type];
                    if (directHandler)
                        directHandler(mapping(event));
                    this.component._eventsSubject$.next({
                        args: mapping(event),
                        type: type
                    })
                });
            };

            attributeChangedCallback(name: string, prev: string, curr: string) {
                this.component._attributesSubject$.next({name, value: curr});
            }
        };
        if (UI.container) {
            elementConstructor.define(info.name);
        } else {
            definitions.push(() => elementConstructor.define(info.name))
        }
    }
}

interface ComponentExtended<TState, TEvents> {
    _attributesSubject$: Subject<{ name, value }>;
    _eventsSubject$: Subject<{ args: any; type: string }>;
    _elementSubject$: Subject<HTMLElement>;

    State$: Observable<TState>;
    Actions$: Observable<{ type: string; payload?: any }>;
    Events: TEvents;

    Render(html, state: TState, events);

    Render$: Subject<any>;

    created();

    // element: HTMLElement;

    select<E extends Element = Element>(selectors: string): Observable<E | null>;
}

export type IEventHandler<TEvents> = {
    [K in keyof TEvents]: (Event) => void
};

