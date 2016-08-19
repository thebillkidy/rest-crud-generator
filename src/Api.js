var Joi = require('joi');
var Model = require('./Model');
var RouteGenerator = require('./adapters/route-generator-hapi');
var generateOptionsSchema = require('./schemes/generateOptions');

/**
 * @param server
 * @constructor
 */
var Api = function (server) {
    if (!server) {
        throw new Error('No http engine given!');
    }

    this.authentication = null; // The authentication plugin used
    this.server = server;
    this.models = [];

    this.routeGenerator = new RouteGenerator(this.server);
};

Api.prototype.getRouteGenerator = function () {
    return this.routeGenerator;
};

/**
 * This should initiate the authentication requirements
 * @param library
 * @param dbConfig
 */
Api.prototype.addAuthentication = function (library, dbConfig) {
    if (!library) {
        return Promise.reject(new Error('Incorrect library'));
    }

    if (!dbConfig) {
        return Promise.reject(new Error('Missing database connection configuration'));
    }

    // TODO: Test if we can connect with the config given
    //dbUtil.connect()

    // Create a new authentication instance
    this.authentication = new library(this.server, dbConfig);

    // Add it to the routegenerator
    this.routeGenerator.addAuthentication(this.authentication);

    // Call the check to see if the tables exist
    return this.authentication.createRequiredTables();
};

Api.prototype.getServer = function () {
    return this.server;
};

Api.prototype.getModels = function () {
    return this.models;
};

/**
 * options: {
 *     routes: {
 *         read: {
 *             roles: [ 'admin' ]
 *         }
 *     }
 * }
 * @param baseModel
 * @param options
 */
Api.prototype.generate = function (baseModel, options) {
    if (!baseModel) {
        throw new Error('Invalid Base Model Specified');
    }

    Joi.validate(options, generateOptionsSchema, { convert: true }, (err, value) => {
        if (err) {
            throw new Error(err);
        }

        options = value;

        var model = new Model(baseModel);

        this.models.push(model);

        console.info('creating REST routes for ' + model.getTableName() + ':');
        if (options.routes.findAll.isEnabled) {
            this.routeGenerator.createFindAllRoute(model, options.routes.findAll.allowedRoles);

            const allowedRoles = options.routes.findAll.allowedRoles || '$everyone';
            console.info('--> created GET /' + model.getBaseRouteName() + ' for: ' + allowedRoles);
        }

        if (options.routes.findOne.isEnabled) {
            this.routeGenerator.createFindOneRoute(model, options.routes.findOne.allowedRoles);

            const allowedRoles = options.routes.findAll.allowedRoles || '$everyone';
            console.info('--> created GET /' + model.getBaseRouteName() + '/{id}' + ' for: ' + allowedRoles);
        }

        if (options.routes.create.isEnabled) {
            this.routeGenerator.createCreateRoute(model, options.routes.create.allowedRoles);

            const allowedRoles = options.routes.findAll.allowedRoles || '$everyone';
            console.info('--> created POST /' + model.getBaseRouteName() + ' for: ' + allowedRoles);
        }

        if (options.routes.update.isEnabled) {
            this.routeGenerator.createUpdateRoute(model, options.routes.update.allowedRoles);

            const allowedRoles = options.routes.findAll.allowedRoles || '$everyone';
            console.info('--> created PUT /' + model.getBaseRouteName() + '/{id}' + ' for: ' + allowedRoles);
        }

        if (options.routes.delete.isEnabled) {
            this.routeGenerator.createDeleteRoute(model, options.routes.delete.allowedRoles);

            const allowedRoles = options.routes.findAll.allowedRoles || '$everyone';
            console.info('--> created DELETE /' + model.getBaseRouteName() + '/{id}' + ' for: ' + allowedRoles);
        }
    });
};

module.exports = function (server) {
    return new Api(server);
};