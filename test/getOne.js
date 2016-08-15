// Load modules
const pluralize = require('pluralize');
const Code = require('code');
const Lab = require('lab');
const lab = exports.lab = Lab.script();
const sinon = require('sinon');

// Define shortcuts
const describe = lab.describe;
const it = lab.it;
const before = lab.before;
const beforeEach = lab.beforeEach;
const after = lab.after;
const expect = Code.expect;

const ORM = require('./helpers/orm-bookshelf');
const User = ORM.Models.User;
const server = require('./helpers/server-hapi').init();
const Api = require('..')(server);

describe('GET /<model> collection', () => {
    before((done) => {
        Api.generate(User);

        done();
    });

    it('should register the GET /<model>/{id} call in the hapi framework', (done) => {
        var routes = server.table()[0].table;
        const routeName =  '/' + pluralize(User.forge().tableName) + '/{id}';

        expect(routes).to.include({ method: 'get' });
        expect(routes).to.include({ path: routeName });

        done();
    });

    it('should not register the GET /<model>/<id> call if isEnabled = false', (done) => {
        const server = require('./helpers/server-hapi').init();
        const Api = require('..')(server);
        Api.generate(User, { routes: { findOne: { isEnabled: false } } });

        var routes = server.table()[0].table;
        const routeName =  '/' + pluralize(User.forge().tableName) + '/{id}';

        expect(routes).to.not.include({ method: 'get', path: routeName });

        done();
    });

    it('should call the fetchOne method in Model.js when we request this route and should return our result', (done) => {
        const models = Api.getModels();

        // Spy on the mock model
        var fetchOneSpy = sinon.spy(models[0], 'findOneById');

        // Perform our normal routine
        const routeName =  '/' + pluralize(User.forge().tableName) + '/1';
        server.start((err) => {
            expect(err).to.not.exist();

            // Note: The calls will fail since we have no connection to the database!
            //       We just want to check if the 'findOneById' function gets called
            server.inject({ method: 'GET', url: routeName }, (res) => {
                // Now check if we called the method fetchAll
                fetchOneSpy.restore();
                sinon.assert.calledOnce(fetchOneSpy);
                sinon.assert.calledWith(fetchOneSpy, "1"); // expect that we call findOneById with id: 1 (see route)

                done();
            });
        });
    });


    it('should call the bearer authentication registration correctly', (done) => {
        const server = require('./helpers/server-hapi').init();
        const Api = require('..')(server);

        const routeGenerator = Api.getRouteGenerator();
        var spy = sinon.spy(routeGenerator, 'addBearerAuthentication');

        Api.addBearerAuthentication(() => { return true; }, () => {
            Api.generate(User, {
                routes: {
                    findOne: {
                        allowedRoles: [ 'admin' ]
                    }
                }
            });

            spy.restore();
            sinon.assert.calledOnce(spy);

            done();
        });
    });

    it('should limit to the specified role, if one is given and return the result when we do have access', (done) => {
        const server = require('./helpers/server-hapi').init();
        const Api = require('..')(server);
        const routeGenerator = Api.getRouteGenerator();

        var spy = sinon.spy(routeGenerator, 'addBearerAuthentication');

        Api.addBearerAuthentication((token, callback) => { return callback(null, true, { scope: ['admin' ]}); }, () => {
            Api.generate(User, {
                routes: {
                    findOne: {
                        allowedRoles: [ 'admin' ]
                    }
                }
            });

            const models = Api.getModels();
            var spy2 = sinon.spy(models[0], 'findOneById'); // should not get called!

            // Perform our normal routine
            const routeName =  '/' + pluralize(User.forge().tableName);
            server.start((err) => {
                expect(err).to.not.exist();

                // Note: The calls will fail since we have no connection to the database!
                //       We just want to check if the 'createObject' function gets called
                let request = {
                    method: 'GET',
                    url: routeName + '/1',
                    headers: {
                        Authorization: 'Bearer <SOMETOKEN>'
                    },
                    payload: {
                        id: '1',
                        first_name: 'Xavier',
                        last_name: 'Geerinck'
                    }
                };

                server.inject(request, (res) => {
                    expect(res.payload).to.exist();

                    console.log(res.payload);

                    expect(spy.callCount).to.equal(1);
                    expect(spy2.callCount).to.equal(1);
                    spy.restore();
                    spy2.restore();

                    done();
                });
            });
        });
    });

    it('should limit to the specified role, if one is given and return Unauthorized when we do not have access', (done) => {
        const server = require('./helpers/server-hapi').init();
        const Api = require('..')(server);
        const routeGenerator = Api.getRouteGenerator();

        var spy = sinon.spy(routeGenerator, 'addBearerAuthentication');

        Api.addBearerAuthentication((token, callback) => { return callback(null, false); }, () => {
            Api.generate(User, {
                routes: {
                    findOne: {
                        allowedRoles: [ 'admin' ]
                    }
                }
            });

            const models = Api.getModels();
            var spy2 = sinon.spy(models[0], 'findOneById'); // should not get called!

            // Perform our normal routine
            const routeName =  '/' + pluralize(User.forge().tableName);
            server.start((err) => {
                expect(err).to.not.exist();

                // Note: The calls will fail since we have no connection to the database!
                //       We just want to check if the 'createObject' function gets called
                let request = {
                    method: 'GET',
                    url: routeName + '/1',
                    headers: {
                        Authorization: 'Bearer <SOMETOKEN>'
                    },
                    payload: {
                        id: '1',
                        first_name: 'Xavier',
                        last_name: 'Geerinck'
                    }
                };

                server.inject(request, (res) => {
                    expect(res.payload).to.exist();
                    expect(JSON.parse(res.payload)).to.exist();
                    expect(JSON.parse(res.payload).error).to.equal('Unauthorized');

                    expect(spy.callCount).to.equal(1);
                    expect(spy2.callCount).to.equal(0); // Create should not be called if unauthorized
                    spy.restore();
                    spy2.restore();

                    done();
                });
            });
        });
    });
});