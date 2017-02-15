import * as React from 'react';
import { RouterError } from 'react-router-async';

function runPromises(items, props = {}) {
    return new Promise((resolve, reject) => {
        let pending = items.length;
        let values = {};
        if (pending == 0) resolve(values);
        function checkAndResolve(value, data) {
            pending--;
            if (data && data.key) values[data.key] = value;
            if (pending == 0) resolve(values);
        }
        items.forEach(item => {
            item.promise(props).then(value => {
                checkAndResolve(value, item.data);
                return value;
            }).catch(error => {
                if (item.critical) {
                    reject(error);
                } else {
                    checkAndResolve(error, item.data);
                }
                // throw error;
            })
        });
    });
}

export interface Options {
    errorHandler?: Function,
    helpers?: Object,
    noFirstFetch?: boolean,
    server?: boolean
}

export function hookFetcher(options: Options = {}) {
    const { noFirstFetch, helpers, server } = options;
    let counter = 0;
    return {
        start: ({ ctx }) => {
            counter++;
            ctx.set('fetcher', {
                items: [],
                deferred: [],
                values: null
            });
        },
        resolve: async ({ path, location, route, status, params, redirect, result, ctx }) => {
            // check if fetcher instance
            if (!result.isFetcher) {
                // TODO: show name of component
                console.warn('Component not wrapped with Fetcher');
                return;
            }
            // set init values
            result.items.forEach(({ data }) => {
                if (data && data.key && data.value) {
                    if (ctx.get('fetcher').values === null) ctx.get('fetcher').values = {};
                    ctx.get('fetcher').values[data.key] = data.value;
                }
            });
            // filter deferred items
            ctx.get('fetcher').deferred = result.items.filter(item => item.deferred);
            if (server) {
                ctx.get('fetcher').items = result.items.filter(item => !item.deferred);
            } else {
                ctx.get('fetcher').items = result.items.filter(item => !item.deferred && !item.server);
            }
            if (counter === 1 && noFirstFetch) return;
            // execute promises and return result
            try {
                const values = await runPromises(ctx.get('fetcher').items, { path, location, route, status, params, redirect, result, ctx, noFirstFetch, helpers });
                if (ctx.get('fetcher').values !== null) Object.assign(ctx.get('fetcher').values, values);
            } catch (error) {
                if (error instanceof RouterError) {
                    return error;
                } else {
                    throw error;
                }
            }
        },
        render: async ({ path, location, route, status, params, redirect, result, ctx }) => {
            if (ctx.get('fetcher').deferred.length) {
                try {
                    // TODO: deffered requests must resolve in parallel
                    const values = await runPromises(ctx.get('fetcher').deferred, { path, location, route, status, params, redirect, result, ctx, noFirstFetch, helpers });
                    if (ctx.get('fetcher').values !== null) Object.assign(ctx.get('fetcher').values, values);
                    if (ctx.get('fetcher').values && ctx.get('fetcher').callback) ctx.get('fetcher').callback(values);
                } catch (error) {
                    if (error instanceof RouterError) {
                        return error;
                    } else {
                        throw error;
                    }
                }
            }
        }
    }
}

export interface ComponentProps {
    router: Object,
    data?: Object
}
export interface Props {
    router: Object
}
export interface State {
    data?: Object
}
// Helps track hot reloading.
// let nextVersion = 0;
export function fetcher(items) {
    // Helps track hot reloading.
    // const version = nextVersion++;
    return function wrapWithFetcherConnect(WrappedComponent) {
        return class FetcherConnect extends React.Component<Props, State> {
            // private version: number;
            static isFetcher = true;
            static items = items;
            constructor(props) {
                super(props);
                // this.version = version;
                if (props.router.ctx.get('fetcher') && props.router.ctx.get('fetcher').values !== null) {
                    this.state = {
                        data: props.router.ctx.get('fetcher').values
                    }
                }
                props.router.ctx.get('fetcher') && (props.router.ctx.get('fetcher').callback = values => {
                    this.setState({
                        data: values
                    })
                })
            }
            render() {
                let props: ComponentProps = {
                    router: this.props.router
                };
                if (this.state && this.state.data !== null) props.data = this.state.data;
                return <WrappedComponent {...props} />
            }
        }
    }
}