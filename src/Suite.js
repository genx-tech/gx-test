const path = require('path');
const { _ } = require('rk-utils');
const { Starters: { startWorker } } = require('@genx/app');

const tokenCache = {};
let allure;

/**
 * Test function with a connected rest client.
 * @callback testWithRestClient
 * @param {App} app - The app
 * @param {RestClient} client - The rest client
 */

 /**
 * Test function with a worker app.
 * @callback testWithApp
 * @param {App} app - The app
 */

/**
 * Test case body.
 * @callback testCaseBody
 * @param {*} data - Test data
 */ 

/**
 * Test suite object.
 * @class
 */
class Suite {    
    /**
     * [private] Suite will be created by testSuite creator.
     * @param {string} name - Suite name
     * @param {object} [options] - Suite options 
     * @property {string} [options.serverEntry="../../src/index.js"] - The entry file of @genx/server instance.
     * @property {boolean} [options.verbose=false] - Verbose mode.
     */
    constructor(name, options) {
        this.name = name;
        const { serverEntry, verbose } = (options == null ? {} : options);

        this.serverEntry = serverEntry || '../../src/index.js';
        this.verbose = verbose;
    }

    /**
     * Start the @genx/server instace for code coverage testing.
     * @async
     * @private
     */
    async startWebServer_() {
        if (this.webServer) {
            throw new Error('Web server already started.');
        }

        const createWebServer = require(this.serverEntry);
        this.webServer = createWebServer({
            exitOnUncaught: false
        });
        this.webServer.started == null || this.webServer.started.should.not.be.ok();
        
        await this.webServer.start_();

        this.webServer.started.should.be.ok();

        return this.webServer;
    };

    /**
     * Stop the server if it is started.
     * @async
     * @private
     */
    async stopWebServerIfStarted_() {
        if (this.webServer) {
            if (this.webServer.started) {
                await this.webServer.stop_();            
            }

            delete this.webServer;
        }           
    }

    /**
     * Start a worker app for testing
     * @param {testWithRestClient} testToRun - Test function with a connected rest client.
     * @param {*} options - Options passed the test worker, see startWorker of @genx/app.
     * @async
     */
    async startWorker_(testToRun, options) {
        let err;

        await startWorker(async (app) => {
            try {
                await testToRun(app);
            } catch (e) {
                err = e;
            }            
        }, {
            workerName: "tester",        
            configName: "test",
            configPath: "./test/conf",
            appModulesPath: "app_modules",
            ignoreUncaught: true,
            ...options
        });

        if (err) {
            should.not.exist(err, err.message || err);
        }    
    }

    /**
     * Start a rest client for testing
     * @param {string} name - The config key of target endpoint
     * @param {string} userTag - The config key of predefined user identity, pass null for guest mode.
     * @param {testWithRestClient} testToRun - Test function with a connected rest client.
     * @param {*} options - Options passed the test worker, see startWorker of @genx/app.
     * @async
     */
    async startRestClient_(name, userTag, testToRun, options) {
        return this.startWorker_(async (app) => {
            const client = await this._getRestClient_(app, name, userTag);
            return testToRun(app, client);
        }, options);
    }

    /**
     * @private
     */
    initAllure() {
        if (!allure) {
            const allureMocha = require('allure-mocha/runtime');            
            allure = allureMocha.allure;
        }
    }

    /**
     * Define a test case.
     * @param {string} story - Test case title.
     * @param {testCaseBody} body - Test case body to write actual test code.
     * @param {object} [options] 
     * @property {*} options.data - Test data
     * @property {function} options.cleanUp - Cleanup after the case ends regardless whether it is successful or not.
     */
    testCase(story, body, options) {
        const { data, cleanUp } = (options == null ? {} : options);

        it(story, async function () {
            if (this.verbose) {
                console.log('Starting story:', story);
            }
    
            if (allure) {
                if (data) {
                    const { description, epic, feature, owner, tag, issues, severity } = data.allure;
    
                    description && allure.description(description);
                    epic && allure.epic(epic);
                    feature && allure.feature(feature);
                    owner && allure.owner(owner);
                    tag && allure.tag(tag);
                    severity && allure.severity(severity);
    
                    _.isEmpty(issues) || (_.forOwn(issues, (link, num) => {
                        allure.issue(num, link);
                    }));
                } 
    
                allure.story(story);
                allure.createStep(`start ${story}`, () => {})();            
    
                if (data && data.params) {
                    _.forOwn(data.params, (v, k) => {
                        if (typeof v === 'object') {
                            allure.parameter(k, '*see attachment*');    
                            this.attachObject(`param[${k}]`, v);
                        } else {
                            allure.parameter(k, v);
                        }                    
                    });
                }
            }

            if (cleanUp) {
                try {
                    await body(data);
                } finally {
                    await cleanUp();
                }
            } else {
                await body(data);
            }            
        });
    }
    
    /**
     * Test case with fixtures.
     * @param {string} story 
     * @param {testCaseBody} body 
     * @param {function} [cleanUp] 
     */
    testCaseFromFixtures(story, body, cleanUp) {
        const p = path.resolve(`test/fixtures/${this.name}.js`);
        const suiteData = require(p);
        if (!suiteData) throw new Error(`Suite data not found. Suite: ${this.name}`);
    
        const { cases, ...others } = suiteData;    
    
        const storyData = cases && cases[story];   
        if (!storyData) throw new Error(`Story data not found. Suite: ${this.name}, story: ${story}`);
    
        _.castArray(storyData).forEach((caseData, i) => {
            const preparedData = {
                allure: others,
                params: _.mapValues(caseData.params, (v) => {
                    if (typeof v === 'function') return v();
                    return v;
                }),
                expected: caseData.expected
            }
            
            this.testCase(`${story}#${i+1}`, body, { data: preparedData, cleanUp }); 
        });    
    }

    /**
     * Define a test step.
     * @param {string} step 
     * @param {function} [body] - Test step body 
     */
    async testStep_(step, body) {    
        if (allure) {        
            allure.createStep(step, () => {})();
        }

        if (this.verbose) {
            console.log('Step: ', step);
        }

        if (body) {
            await body();
        }
    }    

    /**
     * Attach an object to the test report.
     * @param {string} name 
     * @param {*} obj 
     */
    attachObject(name, obj) {
        if (!allure) return;
    
        let type = 'plain/text', content = obj;
    
        if (typeof obj !== 'string') {
            content = JSON.stringify(obj, null, 4);
            type = 'application/json';
        }
    
        allure.createAttachment(name, content, type);
    }

    async _getRestClient_(app, name, userTag) {
        const client = app.getService(this.webServer ? `superTest.${name}` : `restClient.${name}`);
        if (this.webServer) {
            client.server = this.webServer.httpServer;
        }

        if (!client.onSent) {
            client.onSent = (url, result) => {
                this.attachObject(url, result);
            };
        }

        if (!userTag) {
            delete client.onSend; 
            return client;
        }    

        let token, userAuth;

        if (_.isPlainObject(userTag)) {
            token = tokenCache[userTag.userTag];
            userAuth = userTag;
        } else {
            token = tokenCache[userTag];
            userAuth = app.settings.userAuth[userTag];
        }

        if (!token) {
            let res = await client.post(userAuth.endpoint, { username: userAuth.username, password: userAuth.password });
            token = res.token;
            tokenCache[userTag] = token;        

            app.log('info', `Logged in with [${userTag}].`);
        }

        client.onSend = (req) => {                
            req.set('Authorization', `Bearer ${token}`);
        }

        return client;
    }
}

module.exports = Suite;