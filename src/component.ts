import HyperHTMLElement from "hyperhtml-element";
import {Observable, ReplaySubject, Subject, takeUntil} from "@hypertype/core";
import {UI} from "./ui";
import {importStyle} from "./import-styles";

// const HyperHTMLElement: typeof HyperHTMLElementType = HyperHTMLElementJS;
const definitions: Function[] = [];

export function defineComponents() {
    while (definitions.length) {
        definitions.pop()();
    }
}

export const propertySymbol = Symbol('property');

export const property: any = () => (target: any, key: string, properties) => {
    const attr = key.substring(0, key.length - 1).replace(/[A-Z]/g, ch => `-${ch}`).toLowerCase();
    const getSubject = instance => instance[key + 'Subject$'] || (instance[key + 'Subject$'] = new ReplaySubject(1));
    if (!target.constructor[propertySymbol]) {
        target.constructor[propertySymbol] = {};
    }
    target.constructor[propertySymbol][attr] = instance => {
        const subject = getSubject(instance);
        return {
            get(): any {
                return instance[attr];
            },
            set(value): any {
                instance[attr] = value;
                subject.next(value);
            },
            enumerable: true
        }
    };
    if (delete this[key]) {
        Object.defineProperty(target, key, {
            get(): any {
                return getSubject(this).asObservable();
            }
        })
    }
};

export function Component(info: {
    name: string,
    observedAttributes?: string[],
    booleanAttributes?: string[],
    attributes?: string[],
    template: Function,
    style: string
}) {
    return (target) => {
        let Id = 0;
        importStyle(info.style, target.name);
        const elementConstructor = class extends HyperHTMLElement {

            constructor() {
                super();
                if (target[propertySymbol]) {
                    for (let key in target[propertySymbol]) {
                        this[key] = null;
                    }
                }
            }


            static observedAttributes = info.observedAttributes || [];
            static booleanAttributes = info.booleanAttributes || [];
            handlerProxy: any;
            private component: ComponentExtended<any, any>;
            private _id = Id++;
            private eventHandlers = {};

            renderState(state) {
                info.template.call(this, this.html.bind(this), state, this.handlerProxy);
                this.component.Render$.next();
            }

            created() {
                // const dependencies = Reflector.paramTypes(target).map(type => Container.get(type));
                this.component = UI.container.get(target);//new target(...dependencies);

                if (target[propertySymbol]) {
                    for (let key in target[propertySymbol]) {
                        const desrc = target[propertySymbol][key](this.component);
                        desrc.set(this[key]);
                        delete this[key];
                        Object.defineProperty(this, key, desrc);
                    }
                }
                // this.component.element = this;
                // this.component.element = this;
                this.component['id'] = this._id;
                this.handlerProxy = new Proxy({}, {
                    get: (target, key) => {
                        return this.getEventHandler(key);
                    }
                });
                // @ts-ignore
                this.component._elementSubject$.next(this);
                this.component.State$.pipe(
                    takeUntil(this.component._disconnect$.asObservable())
                ).subscribe(state => {
                    this.renderState(state);
                });
                this.component.Actions$.pipe(
                    takeUntil(this.component._disconnect$.asObservable())
                ).subscribe();
                // this.component.created();
            }

            getEventHandler = type => mapping => {
                const key = `${type}.${mapping}`;
                if (this.eventHandlers[key])
                    return this.eventHandlers[key];
                return (this.eventHandlers[key] = event => {
                    event.preventDefault();
                    const directHandler = this.component.Events && this.component.Events[type];
                    if (directHandler)
                        directHandler(mapping(event));
                    this.component._eventsSubject$.next({
                        args: mapping(event),
                        type: type
                    });
                    return false;
                });
            };

            attributeChangedCallback(name: string, prev: string, curr: string) {
                if (this.component[propertySymbol] && this.component[propertySymbol][name]) {
                    this.component[propertySymbol][name].set(curr);
                }
                this.component._attributesSubject$.next({name, value: curr});
            }

            disconnectedCallback(){
                this.component._disconnect$.next();
                this.component._disconnect$.complete();
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
    _disconnect$: ReplaySubject<void>;
    element: HyperHTMLElement;
    _attributesSubject$: Subject<{ name, value }>;
    _eventsSubject$: Subject<{ args: any; type: string }>;
    _elementSubject$: Subject<HTMLElement>;

    State$: Observable<TState>;
    Actions$: Observable<{ type: string; payload?: any }>;
    Events: TEvents;
    Render$: Subject<any>;

    Render(html, state: TState, events);

    created();

    // element: HTMLElement;

    select<E extends Element = Element>(selectors: string): Observable<E | null>;
}

export type IEventHandler<TEvents> = {
    [K in keyof TEvents]: (Event) => void
};

