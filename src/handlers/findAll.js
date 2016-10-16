const Boom = require('boom');
const accessScopesEnum = require('../enums/accessScopes');

module.exports = (routeGenerator, model, routeOptions) => {
    return (request, reply) => {
        let accessScope = routeGenerator.getAccessScope(null, routeOptions.allowedRoles);

        if (routeGenerator.authentication && routeOptions.allowedRoles) {
            accessScope = routeGenerator.getAccessScope(request.auth.credentials.get('scope'), routeOptions.allowedRoles);
        }

        let queryParams = routeGenerator.processQueryParams(request.query);
        let promise = null;

        // Process the access scope
        switch (accessScope) {
            case accessScopesEnum.ALL_ACCESS:
                promise = model.findAll(queryParams);
                break;
            case accessScopesEnum.OWNER_ACCESS:
                promise = model.findAllByUserId(request.auth.credentials.get('id'), queryParams);
                break;
            case accessScopesEnum.NO_ACCESS:
                promise = Promise.resolve(Boom.unauthorized());
                break;
            // The default is that we have the ALL_ACCESS scope
            default:
                promise = model.findAll();
        }

        // Handle the reply
        promise
        .then((results) => {
            return reply(results);
        })
        .catch((err) => {
            //console.error(`[ERR: ${err.code}]: ${err.message}`);
            return reply(err);
        });
    }
};