var fs = require('fs');
function gxtest(params) {
    if(fs.existsSync('test') === false){
        fs.mkdirSync('test');
    }
    if(fs.existsSync('test/conf') === false){
        fs.mkdirSync('test/conf');
    }
    if(fs.existsSync('test/mocha-multi-reporters.json') === false){
        fs.appendFile('test/mocha-multi-reporters.json', 
    `{    
        "progress": {
            "stdout": "-",        
            "options": {
                "verbose": true
            }
        },
        "allure-mocha": {
            "stdout": "-",
            "options": {
                "resultsDir": "./allure-results"
            }
        }
    }`, function (err) {
            if (err) throw err;
        });
    }
    if(fs.existsSync('test/test.local.js') === false){
        fs.appendFile('test/test.local.js', 
    `module.exports = {
        only: [
            //"api-dev-deal-e2e",
            //"api-agent-private-inspection",
            "api-client-private-inspection",
            //"api-agency-deal-e2e",
            //"model-agency-readflag",
            //"model-developer-stats",
            //"api-dev-deal-e2e-half",
            //"api-dev-issues-99",
            //"api-dev-issues-117"
        ],
        skip: [

        ]
    }`, function (err) {
            if (err) throw err;
        });
    }
    if(fs.existsSync('test/conf/test.default.json') === false){
        fs.appendFile('test/conf/test.default.json', 
    `const testSuite = require("@genx/test");
    const Expression = require("@genx/jes");

    testSuite(__filename, function (suite) {
        suite.testCase("login and get profile", async function () {
            await suite.startRestClient_("<endpointKey>", "<userIdentityKey>", async (app, client) => {
                await suite.testStep_("my-profile", async () => {
                    const myProfile = await client.get(["my-profile"]);

                    Expression.match(myProfile, {
                        status: "success",
                        response: {
                            id: { $exists: true },
                            agency: { $exists: true },
                            user: { $exists: true },
                        },
                    })[0].should.be.ok();
                });
            });
        }, {});
    }, { verbose: true });`, function (err) {
            if (err) throw err;
        });
    }
    if(fs.existsSync('./package.json') !== false){
        let rawdata = fs.readFileSync('./package.json');
        let pack = JSON.parse(rawdata);

        pack.scripts.test = 'npm run test:clean && cross-env NODE_RT=babel mocha --reporter mocha-multi --reporter-options mocha-multi=test/mocha-multi-reporters.json test/*.spec.js';
        pack.scripts.cover = 'npm run test:clean && cross-env COVER_MODE=1 NODE_RT=babel nyc --reporter=html --reporter=text -- mocha --reporter progress test/*.spec.js && open ./coverage/index.html';
        pack.scripts.report = 'allure generate allure-results --clean -o allure-report && allure open allure-report';

        let data = JSON.stringify(pack,null,4);
        fs.writeFileSync('package.json', data);
    }
}
module.exports.gxtest = gxtest;