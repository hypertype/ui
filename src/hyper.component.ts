import {filter, first, map, NEVER, Observable, of, ReplaySubject, scan, startWith, Subject, withLatestFrom} from "./rx";

export abstract class HyperComponent<TState = any, TEvents = any> {

    State$: Observable<TState> = of(null);
    Actions$: Observable<{ type: string; payload?: any }> = NEVER;

    protected defaultState: TState;
    private _attributesSubject$ = new ReplaySubject<{ name, value }>();
    private _eventsSubject$ = new ReplaySubject<{ args: any; type: keyof TEvents; }>();
    private _elementSubject$: Subject<HTMLElement> = new ReplaySubject<HTMLElement>();
    protected Element$: Observable<HTMLElement> = this._elementSubject$.asObservable().pipe(
        filter(x => !!x)
    );
    protected Events$ = this._eventsSubject$.asObservable();
    protected Attributes$: Observable<any> = this._attributesSubject$.asObservable().pipe(
        scan<{ name, value }, any>((acc, val) => ({...acc, [val.name]: val.value}), {}),
        startWith({}),
    );

    protected Render$ = new ReplaySubject();

    protected select<E extends Element = Element>(selector: string): Observable<E | null> {
        return this.Render$.asObservable().pipe(
            withLatestFrom(this.Element$),
            map(([_, element]) => element.querySelector(selector))
        );
    }


    protected InjectedContent$ = this.Element$.pipe(
        filter(element => element.childNodes.length > 0),
        map(element => {
            const children = [].slice.call(element.childNodes);
            children.forEach(c => element.removeChild(c));
            return children;
        }),
        first()
    );

    protected Events: TEvents;
}