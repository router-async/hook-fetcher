import * as React from 'react';

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
                throw error;
            })
        });
    });
}

export interface Options {
    errorHandler?: Function
}

export function hookFetcher(options: Options = {}) {
    return {
        start: ({ ctx }) => {
            ctx.set('fetcher', {
                items: [],
                deferred: [],
                values: {}
            });
        },
        resolve: async ({ ctx, params, result }) => {
            // check if fetcher instance
            if (!result.isFetcher) {
                console.warn('Component not wrapped with Fetcher');
                return;
            }
            // set init values
            result.items.forEach(({ data }) => {
                if (data && data.key && data.value) {
                    ctx.get('fetcher').values[data.key] = data.value;
                }
            });
            // filter deferred items
            ctx.get('fetcher').deferred = result.items.filter(item => item.deferred);
            ctx.get('fetcher').items = result.items.filter(item => !item.deferred);
            // execute promises and return result
            try {
                const values = await runPromises(ctx.get('fetcher').items, { params });
                Object.assign(ctx.get('fetcher').values, values);
            } catch (error) {
                if (options.errorHandler) {
                    options.errorHandler(error);
                } else {
                    console.error('Hook fetcher resolve error', error);
                    throw error;
                }
            }
        },
        render: async ({ ctx, params }) => {
            if (ctx.get('fetcher').deferred.length) {
                try {
                    const values = await runPromises(ctx.get('fetcher').deferred, { params });
                    Object.assign(ctx.get('fetcher').values, values);
                    if (ctx.get('fetcher').callback) ctx.get('fetcher').callback(values);
                } catch (error) {
                    if (options.errorHandler) {
                        options.errorHandler(error);
                    } else {
                        console.error('Hook fetcher render error', error);
                        throw error;
                    }
                }
            }
        }
    }
}

export interface Props {
    router: Object
}
export interface State {
    data: Object
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
                this.state = {
                    data: props.router.ctx.get('fetcher').values
                };
                props.router.ctx.get('fetcher').callback = values => {
                    this.setState({
                        data: values
                    })
                }
            }
            render() {
                return <WrappedComponent data={this.state.data} router={this.props.router} />
            }
        }
    }
}