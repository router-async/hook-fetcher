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
        match: async ({ path, location, route, status, params, redirect, ctx }) => {
            // check if fetcher exists
            if (!Array.isArray(route.fetcher)) {
                // console.warn('No fetcher items');
                return;
            }
            // set init values
            route.fetcher.forEach(({ data }) => {
                if (data && data.key && data.value) {
                    if (ctx.get('fetcher').values === null) ctx.get('fetcher').values = {};
                    ctx.get('fetcher').values[data.key] = data.value;
                }
            });
            // filter deferred items
            ctx.get('fetcher').deferred = route.fetcher.filter(item => item.deferred);
            if (server) {
                ctx.get('fetcher').items = route.fetcher.filter(item => !item.deferred);
            } else {
                ctx.get('fetcher').items = route.fetcher.filter(item => !item.deferred && !item.server);
            }
            if (counter === 1 && noFirstFetch) return;
            // execute promises and return result
            try {
                const values = await runPromises(ctx.get('fetcher').items, { path, location, route, status, params, redirect, ctx, noFirstFetch, helpers });
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
