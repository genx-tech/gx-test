if (process.env.ASYNC_DUMP) {
    require('./asyncDump');
}

const path = require('path');
const { _, fs } = require('rk-utils');
const { Starters: { startWorker } } = require('@genx/app');

let webServer;

/**
 * 
 * @param {*} serverEntry - Server entry file path (relative to test working path)
 */
async function startWebServer(serverEntry) {
    const createWebServer = require(serverEntry || '../../src/index.js');
    webServer = createWebServer({
        exitOnUncaught: false
    });
    webServer.started == null || webServer.started.should.not.be.ok();
    
    await webServer.start_();

    webServer.started.should.be.ok();

    return webServer;
};

/**
 * Run a test function in a worker
 * @param {*} testToRun 
 * @returns {Promise.<*>}
 */
exports.startRestClient = async (name, userTag, testToRun, options) => {
    let err;

    await startWorker(async (app) => {
        const client = await getRestClient(app, name, userTag);
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
};

const tokenCache = {};

async function getRestClient(app, name, userTag) {
    const client = app.getService(webServer ? `superTest.${name}` : `restClient.${name}`);
    if (webServer) {
        client.server = webServer.httpServer;
    }

    if (!client.onSent) {
        client.onSent = (url, result) => {
            attachObject(url, result);
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
};

let suiteName;

exports.testSuite = (file, body, { before: onBefore, after: onAfter, serverEntry } = {}) => {
    suiteName = path.basename(file, '.spec.js');

    const testOptsFile = path.resolve('test/test.local.js');

    let opt;    

    if (fs.existsSync(testOptsFile)) {
        const testOpts = require(testOptsFile);        
        const only = new Set(testOpts.only);        

        if (only.has(suiteName)) {
            opt = 'only';   
        } else {
            if (!_.isEmpty(testOpts.only)) {                
                console.log(`Suite "${suiteName}" skipped.`);
            } else {
                const skip = new Set(testOpts.skip);
                if (skip.has(suiteName)) {
                    opt = 'skip';
                    console.log(`Suite "${suiteName}" skipped.`);
                }
            }            
        }        
    }

    (opt ? describe[opt] : describe)(suiteName, function () {
        if (process.env.COVER_MODE || onBefore) {
            before(async () => {
                if (process.env.COVER_MODE) {
                   webServer = await startWebServer(serverEntry);
                }            
   
                if (onBefore) {
                    await onBefore();
                }
            });   
        }

        if (process.env.COVER_MODE || onAfter) {
            after(async () => {
                console.log();

                if (webServer && webServer.started) {
                   await webServer.stop_();
                   webServer = undefined;
                }            
   
                if (onAfter) {
                    await onAfter();                    
                }

                if (process.env.ASYNC_DUMP) {
                    asyncDump(process.env.ASYNC_DUMP.length > 1 ? process.env.ASYNC_DUMP : null);
                }
            });   
        }

        body();
    });
}

function testCase(story, body, data) {
    it(story, async function () {
        const { allure } = require('allure-mocha/runtime');

        if (allure) {
            if (data) {
                const { description, epic, feature, owner, tag, issues, severity } = data.allure;

                //console.log(data.allure);

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

        await body(data);
    });
}

exports.testCase = testCase;

exports.testCaseFromFixtures = (story, body) => {
    const p = path.resolve(`test/fixtures/${suiteName}.js`);
    const suiteData = require(p);
    if (!suiteData) throw new Error(`Suite data not found. Suite: ${suiteName}`);

    const { cases, ...others } = suiteData;    

    const storyData = cases && cases[story];   
    if (!storyData) throw new Error(`Story data not found. Suite: ${suiteName}, story: ${story}`);

    _.castArray(storyData).forEach((caseData, i) => {
        const preparedData = {
            allure: others,
            params: _.mapValues(caseData.params, (v) => {
                if (typeof v === 'function') return v();
                return v;
            }),
            expected: caseData.expected
        }
        
        testCase(`${story}#${i+1}`, body, preparedData); 
    });    
}

function attachObject(name, obj) {
    const { allure } = require('allure-mocha/runtime');
    if (!allure) return;

    let type = 'plain/text', content = obj;

    if (typeof obj !== 'string') {
        content = JSON.stringify(obj, null, 4);
        type = 'application/json';
    }

    allure.createAttachment(name, content, type);
}

exports.attachObject = attachObject;

exports.testStep = async (step, body) => {
    const { allure } = require('allure-mocha/runtime');
    if (allure) {
        allure.createStep(step, () => {})();
    }

    await body();
}