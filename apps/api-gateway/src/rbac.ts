import { UserRole } from "shared"


export type RBACRule = {
    method : string,
    path : string,
    roles : UserRole[]
}

export const publicRoutes = [
    {
        method : "POST",
        path : "/auth/login",
    },
    {
        method : "POST",
        path : "/auth/register",
    }
] as const;

const rbacRules : RBACRule[] = [
    {
        method : "GET",
        path : "/auth/me",
        roles : ['admin', 'user']
    },
    {
        method : "POST",
        path : "/tasks",
        roles : ['admin', 'user']
    },
    {
        method : "GET",
        path : "/tasks",
        roles : ['admin', 'user']
    },
    {
        method : "GET",
        path : "/tasks/:id",
        roles : ['admin', 'user']
    },
    {
        method : "PUT",
        path : "/tasks/:id",
        roles : ['admin', 'user']
    },
    {
        method : "DELETE",
        path : "/tasks/:id",
        roles : ['admin', 'user']
    },
    {
        method : "POST",
        path : "/tasks/:taskId/attachments",
        roles : ['admin', 'user']
    },
    {
        method : "GET",
        path : "/tasks/:taskId/attachments",
        roles : ['admin', 'user']
    },
    {
        method : "GET",
        path : "/tasks/:taskId/workflows",
        roles : ['admin', 'user']
    }
]

function matchPath(pattern : string, actual : string) : boolean {
    if(pattern === actual){
        return true;
    }
    const patternParts = pattern.split('/');
    const actualParts = actual.split('/');
    if(patternParts.length !== actualParts.length){
        return false;
    }
    return patternParts.every((part, index) => part.startsWith(':') || part === actualParts[index]);
}


export function isPublicRoute(method : string, path : string) : boolean {
    return publicRoutes.some(route => route.method === method && matchPath(route.path, path));
}

export function getAllowedRules(method : string, path : string) : UserRole[] {
    const rule = rbacRules.find(rule => rule.method === method && matchPath(rule.path, path));
    return rule?.roles || [];
}
