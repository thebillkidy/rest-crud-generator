"use strict";

const Joi = require('joi');
const Boom = require('boom');
const accessScopesEnum = require('./enums/accessScopes');
const rootOptionsSchema = require('./schemes/rootOptions');

class RouteGenerator {
    constructor (adapter, authentication, options) {
        this.adapter = adapter;
        this.authentication = authentication;
        this.options = Joi.validate(options, rootOptionsSchema, { convert: true }).value; // No error reporting here, it gets caught by the main framework
    }

    processRoles (model, rolesAllowed, routeOptions) {
        if (rolesAllowed && this.authentication) {
            routeOptions.config = {};
            routeOptions.config.auth = {
                strategy: this.authentication.strategyName,
                scope: rolesAllowed
            };
        }

        return routeOptions;
    }

    /**
     * Gets the amount of access we have for a certain route, this gets divided into 3 levels:
     * - ALL_ACCESS: We have a custom access that matches our scope in the user table, return all the objects!
     * - OWNER_ACCESS: We have $owner access, so we need to return all the objects that we own
     * - NO_ACCESS: Not authorized to access this route
     * @param userScope the scopes that the user has
     * @param rolesAllowed the roles that are allowed to a certain route
     * @param model
     */
    getAccessScope (userScope, rolesAllowed) {
        // if no user scope and rolesAllowed has been passed, then we return ALL_ACCESS
        if (!userScope && !rolesAllowed) {
            return accessScopesEnum.ALL_ACCESS;
        }

        // If no rolesAllowed is specified, we allow everyone!
        if (!Array.isArray(rolesAllowed) && !rolesAllowed) {
            return accessScopesEnum.ALL_ACCESS;
        }

        if (Array.isArray(userScope)) {
            for (var scope of userScope) {
                if (scope != '$owner' && rolesAllowed.indexOf(scope) > -1) {
                    return accessScopesEnum.ALL_ACCESS;
                }
            }

            if (rolesAllowed.indexOf('$owner') > -1) {
                return accessScopesEnum.OWNER_ACCESS;
            }
        } else {
            if (rolesAllowed.indexOf(userScope) > -1) {
                return accessScopesEnum.ALL_ACCESS;
            }

            if (rolesAllowed.indexOf('$owner') > -1) {
                return accessScopesEnum.OWNER_ACCESS;
            }
        }

        return accessScopesEnum.NO_ACCESS;
    }

    generateFindAll (model, rolesAllowed) {
        var self = this;

        var routeOptions = {
            method: 'GET',
            path: `${this.options.basePath}/${model.baseRoute}`,
            handler: (request, reply) => {
                let accessScope = self.getAccessScope(null, rolesAllowed);

                if (self.authentication && rolesAllowed) {
                    accessScope = self.getAccessScope(request.auth.credentials.get('scope'), rolesAllowed);
                }

                switch (accessScope) {
                    case accessScopesEnum.ALL_ACCESS:
                        reply(model.findAll());
                        break;
                    case accessScopesEnum.OWNER_ACCESS:
                        reply(model.findAllByUserId(request.auth.credentials.get('id')));
                        break;
                    case accessScopesEnum.NO_ACCESS:
                        reply(Boom.unauthorized());
                        break;
                    // The default is that we have the ALL_ACCESS scope
                    default:
                        reply(model.findAll());
                }
            }
        };

        return self.processRoles(model, rolesAllowed, routeOptions);
    }

    generateFindAllWithPagination (model, rolesAllowed) {
        var self = this;

        var routeOptions = {
            method: 'GET',
            path: `${this.options.basePath}/${model.baseRoute}/pagination/{offset}`,
            config: {
                validate: {
                    query: {
                        limit: Joi.number().max(20),
                        access_token: Joi.string().optional()
                    }
                }
            },
            handler: (request, reply) => {
                let limit = request.query.limit;
                let offset = request.params.offset;

                let accessScope = self.getAccessScope(null, rolesAllowed);

                if (self.authentication && rolesAllowed) {
                    accessScope = self.getAccessScope(request.auth.credentials.get('scope'), rolesAllowed);
                }

                let results;

                switch (accessScope) {
                    case accessScopesEnum.ALL_ACCESS:
                        model.findAllWithPagination(offset, limit)
                        .then((results) => {
                            reply({
                                results: results.toJSON(),
                                pagination: results.pagination
                            });
                        });
                        break;
                    case accessScopesEnum.OWNER_ACCESS:
                        model.findAllByUserIdWithPagination(request.auth.credentials.get('id'), offset, limit)
                        .then((results) => {
                            reply({
                                results: results.toJSON(),
                                pagination: results.pagination
                            });
                        });
                        break;
                    case accessScopesEnum.NO_ACCESS:
                    default:
                        reply(Boom.unauthorized());
                }
            }
        };

        return self.processRoles(model, rolesAllowed, routeOptions);
    }

    generateFindOne (model, rolesAllowed) {
        var self = this;

        var routeOptions = {
            method: 'GET',
            path: `${this.options.basePath}/${model.baseRoute}/{id}`,
            handler: (request, reply) => {
                var id = request.params.id;

                let accessScope = self.getAccessScope(null, rolesAllowed);

                if (self.authentication && rolesAllowed) {
                    accessScope = self.getAccessScope(request.auth.credentials.get('scope'), rolesAllowed);
                }

                switch (accessScope) {
                    case accessScopesEnum.ALL_ACCESS:
                        reply(model.findOneById(id));
                        break;
                    case accessScopesEnum.OWNER_ACCESS:
                        reply(model.findOneByIdAndUserId(id, request.auth.credentials.get('id')));
                        // self.authentication.hasAccessToRow(request, rolesAllowed, model)
                        // .then((hasAccess) => {
                        //     if (hasAccess) {
                        //         return reply(model.findOneById(id));
                        //     }
                        //
                        //     return reply(Boom.unauthorized());
                        // });
                        break;
                    case accessScopesEnum.NO_ACCESS:
                    default:
                        reply(Boom.unauthorized());
                }
            }
        };

        return self.processRoles(model, rolesAllowed, routeOptions);
    }

    generateCreate (model, rolesAllowed) {
        var self = this;

        var routeOptions = {
            method: 'POST',
            path: `${this.options.basePath}/${model.baseRoute}`,
            handler: (request, reply) => {
                let accessScope = self.getAccessScope(null, rolesAllowed);

                if (self.authentication && rolesAllowed) {
                    accessScope = self.getAccessScope(request.auth.credentials.get('scope'), rolesAllowed);
                }

                switch (accessScope) {
                    case accessScopesEnum.ALL_ACCESS:
                    case accessScopesEnum.OWNER_ACCESS:
                        reply(model.createObject(request.payload));
                        break;
                    case accessScopesEnum.NO_ACCESS:
                    default:
                        reply(Boom.unauthorized());
                }
            }
        };

        return self.processRoles(model, rolesAllowed, routeOptions);
    }

    generateUpdate (model, rolesAllowed) {
        var self = this;

        var routeOptions = {
            method: 'PUT',
            path: `${this.options.basePath}/${model.baseRoute}/{id}`,
            handler: (request, reply) => {
                let id = request.params.id;
                let accessScope = self.getAccessScope(null, rolesAllowed);

                if (self.authentication && rolesAllowed) {
                    accessScope = self.getAccessScope(request.auth.credentials.get('scope'), rolesAllowed);
                }

                switch (accessScope) {
                    case accessScopesEnum.ALL_ACCESS:
                        reply(model.updateById(id, request.payload));
                        break;
                    case accessScopesEnum.OWNER_ACCESS:
                        reply(model.updateByIdAndUserId(id, request.auth.credentials.get('id')));
                        break;
                    case accessScopesEnum.NO_ACCESS:
                    default:
                        reply(Boom.unauthorized());
                }
            }
        };

        return self.processRoles(model, rolesAllowed, routeOptions);
    }

    generateDelete (model, rolesAllowed) {
        var self = this;

        var routeOptions = {
            method: 'DELETE',
            path: `${this.options.basePath}/${model.baseRoute}/{id}`,
            handler: (request, reply) => {
                let id = request.params.id;
                let accessScope = self.getAccessScope(null, rolesAllowed);

                if (self.authentication && rolesAllowed) {
                    accessScope = self.getAccessScope(request.auth.credentials.get('scope'), rolesAllowed);
                }

                switch (accessScope) {
                    case accessScopesEnum.ALL_ACCESS:
                        reply(model.destroyById(id));
                        break;
                    case accessScopesEnum.OWNER_ACCESS:
                        reply(model.destroyByIdAndUserId(id, request.auth.credentials.get('id')));
                        break;
                    case accessScopesEnum.NO_ACCESS:
                    default:
                        reply(Boom.unauthorized());
                }
            }
        };

        return self.processRoles(model, rolesAllowed, routeOptions);
    }

    generateCount (model, rolesAllowed) {
        var self = this;

        var routeOptions = {
            method: 'GET',
            path: `${this.options.basePath}/${model.baseRoute}/count`,
            handler: (request, reply) => {
                let accessScope = self.getAccessScope(null, rolesAllowed);

                if (self.authentication && rolesAllowed) {
                    accessScope = self.getAccessScope(request.auth.credentials.get('scope'), rolesAllowed);
                }

                switch (accessScope) {
                    case accessScopesEnum.ALL_ACCESS:
                        reply(model.count());
                        break;
                    case accessScopesEnum.OWNER_ACCESS:
                        reply(model.countByUserId(request.auth.credentials.get('id')));
                        break;
                    case accessScopesEnum.NO_ACCESS:
                    default:
                        reply(Boom.unauthorized());
                }
            }
        };

        return self.processRoles(model, rolesAllowed, routeOptions);
    }
}

module.exports = RouteGenerator;