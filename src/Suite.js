const path = require('path');
const { _ } = require('rk-utils');
const { Starters: { startWorker } } = require('@genx/app');

const tokenCache = {};
let allure;

class Suite {
    constructor(name, { serverEntry, verbose }) {
        this.name = name;
        this.serverEntry = serverEntry || '../../src/index.js';
        this.verbose = verbose;
    }

    /**
     * 
     * @param {*} serverEntry - Server entry file path (relative to test working path)
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

    async stopWebServerIfStarted_() {
        if (this.webServer) {
            if (this.webServer.started) {
                await this.webServer.stop_();            
            }

            delete this.webServer;
        }           
    }

    /**
     * Run a test function in a worker
     * @param {*} testToRun 
     * @returns {Promise.<*>}
     */
    async startRestClient_(name, userTag, testToRun, options) {
        let err;

        await startWorker(async (app) => {
            const client = await this._getRestClient_(app, name, userTag);
            try {
                await testToRun(app, client);
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

    initAllure() {
        if (!allure) {
            const allureMocha = require('allure-mocha/runtime');            
            allure = allureMocha.allure;
        }
    }

    testCase(story, body, { data, cleanUp }) {
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
                            attachObject(`param[${k}]`, v);
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

    async testStep_(step, body) {    
        if (allure) {        
            allure.createStep(step, () => {})();
        }

        if (this.verbose) {
            console.log('Step: ', step);
        }

        await body();
    }    

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