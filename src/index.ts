function runPromises(items, props = {}) {
    return new Promise((resolve, reject) => {
        let pending = items.length;
        if (pending == 0) resolve();
        function checkAndResolve(value) {
            pending--;
            if (pending == 0) resolve(value);
        }
        items.forEach(promise => {
            promise.promise(props).then(value => {
                checkAndResolve(value);
                return value;
            }).catch(error => {
                if (promise.critical) {
                    reject(error);
                } else {
                    checkAndResolve(error);
                }
                throw error;
            })
        });
    });
}

export interface Options {
    errorHandler?: Function
}

export class Data {
    private keys: Object;
    constructor() {
        this.keys = {};
    }
    set(key: string, value) {
        if (key in this.keys && value in this.keys[key]) {
            console.warn(`Value: ${this.keys[key].value} is already set to key: ${key} in data. You try to set value: ${value}`);
        } else {
            if (key in this.keys) {
                this.keys[key].value = value;
            } else {
                this.keys[key] = { value }
            }
        }
    }
    setInitVal(key: string, initVal) {
        if (key in this.keys && initVal in this.keys[key]) {
            console.warn(`Initial Value: ${this.keys[key].initVal} is already set to key: ${key} in data. . You try to set initial value: ${initVal}`);
        } else {
            if (key in this.keys) {
                this.keys[key].initVal = initVal;
            } else {
                this.keys[key] = { initVal }
            }
        }
    }
    get(key: string) {
        if (key in this.keys) {
            return this.keys[key].value ? this.keys[key].value : this.keys[key].initVal;
        } else {
            return null;
        }
    }
}

export default function hookFetcher(options: Options = {}) {
    return {
        start: ({ ctx }) => {
            ctx.set('fetcher', {
                items: [],
                deferred: [],
                data: new Data()
            });
        },
        resolve: async ({ ctx, params }) => {
            // filter deferred items
            ctx.get('fetcher').deferred = ctx.get('fetcher').items.filter(item => item.deferred);
            let items = ctx.get('fetcher').items.filter(item => !item.deferred);
            // execute promises and return result
            try {
                await runPromises(items, { params });
            } catch (error) {
                if (options.errorHandler) {
                    options.errorHandler(error);
                } else {
                    console.error('Hook fetcher resolve error', error);
                    throw error;
                }
            }
        },
        render: async ({ ctx, params, result }) => {
            if (ctx.get('fetcher').deferred.length) {
                try {
                    await runPromises(ctx.get('fetcher').deferred, { params });
                    if (ctx.get('fetcher').callback) ctx.get('fetcher').callback();
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