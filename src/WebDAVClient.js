if (typeof module !== "undefined") {
    XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
    btoa = require('btoa');
    URL = require('url-parse');
}

/**
 * WebDAV client that handles storage of binary files
 */
class WebDAVClient {
    
    constructor(options) {

        this.baseUrl = null;
        this.userName = null;
        this.password = null;
        this.xmlNamespaces = {
            'DAV:' : 'd'
        };
        options = options || {};

        for(let i in options) {
            this[i] = options[i];
        }
    }

    /**
     * Escape special characters in an XML string
     * @param {type} s string to exacpe
     * @returns escaped string
     */
    static _escapeXml(s) {
        return s.replace(/[<>&"']/g, function (ch) {
            switch (ch) {
                case '<': return '&lt;';
                case '>': return '&gt;';
                case '&': return '&amp;';
                case '"': return '&quot;';
                case "'": return '&apos;';
            }
        });
    }

    /**
     * Generates a propFind request.
     *
     * @param {string} url Url to do the propfind request on
     * @param {Array} properties List of properties to retrieve.
     * @param {string} depth "0", "1" or "infinity"
     * @param {Object} [headers] headers
     * @return {Promise}
     */
    propFind(url, properties, depth, headers) {

        if(typeof depth === "undefined") {
            depth = '0';
        }

        // depth header must be a string, in case a number was passed in
        depth = '' + depth;

        headers = headers || {};

        headers['Depth'] = depth;
        headers['Content-Type'] = 'application/xml; charset=utf-8';

        let body ='<?xml version="1.0"?><d:propfind ';
        let namespace;
        for (namespace in this.xmlNamespaces) {
            body += ' xmlns:' + this.xmlNamespaces[namespace] + '="' + namespace + '"';
        }
        body += '><d:prop>';

        for (let ii in properties) {
            if (!properties.hasOwnProperty(ii)) {
                continue;
            }

            let property = this.parseClarkNotation(properties[ii]);
            if (property && this.xmlNamespaces[property.namespace]) {
                body += '<' + this.xmlNamespaces[property.namespace] + ':' + property.name + ' />';
            } else {
                body += '<x:' + property.name + ' xmlns:x="' + property.namespace + '" />';
            }

        }
        body += '</d:prop></d:propfind>';

        return this
            .request('PROPFIND', url, headers, body)
            .then((result) => {
                return {
                    status: result.status,
                    body: depth === '0' ? result.body[0] : result.body,
                    xhr: result.xhr
                };
            }
        );

    }

    /**
     * Renders a "d:set" block for the given properties.
     *
     * @param {Object.<String,String>} properties
     * @return {String} XML "<d:set>" block
     */
    _renderPropSet(properties) {
        let body = '<d:set><d:prop>';

        for (let ii in properties) {
            if (!properties.hasOwnProperty(ii))
                continue;

            let property = this.parseClarkNotation(ii);
            let propName;
            let propValue = properties[ii];
            if (this.xmlNamespaces[property.namespace]) {
                propName = this.xmlNamespaces[property.namespace] + ':' + property.name;
            } else {
                propName = 'x:' + property.name + ' xmlns:x="' + property.namespace + '"';
            }

            // FIXME: hard-coded for now until we allow properties to
            // specify whether to be escaped or not
            if (propName !== 'd:resourcetype') {
                propValue = _escapeXml(propValue);
            }
            body += '<' + propName + '>' + propValue + '</' + propName + '>';
        }
        body += '</d:prop></d:set>';
        return body;
    }

    /**
     * Generates a propPatch request.
     *
     * @param {string} url Url to do the proppatch request on
     * @param {Object.<String,String>} properties List of properties to store.
     * @param {Object} [headers] headers
     * @return {Promise}
     */
    propPatch(url, properties, headers) {
        headers = headers || {};

        headers['Content-Type'] = 'application/xml; charset=utf-8';

        let body =
            '<?xml version="1.0"?><d:propertyupdate ';
        let namespace;
        for (namespace in this.xmlNamespaces) {
            body += ' xmlns:' + this.xmlNamespaces[namespace] + '="' + namespace + '"';
        }
        body += '>' + this._renderPropSet(properties) + '</d:propertyupdate>';

        return this.request('PROPPATCH', url, headers, body)
            .then((result) => {
                return {
                    status: result.status,
                    body: result.body,
                    xhr: result.xhr
                };
            }
        );

    }

    /**
     * Generates a MKCOL request.
     * If attributes are given, it will use an extended MKCOL request.
     *
     * @param {string} url Url to do the proppatch request on
     * @param {Object.<String,String>} [properties] list of properties to store.
     * @param {Object} [headers] headers
     * @return {Promise}
     */
    mkcol(url, properties, headers) {
        let body = '';
        headers = headers || {};
        headers['Content-Type'] = 'application/xml; charset=utf-8';

        if (properties) {
            body =
                '<?xml version="1.0"?><d:mkcol';
            let namespace;
            for (namespace in this.xmlNamespaces) {
                body += ' xmlns:' + this.xmlNamespaces[namespace] + '="' + namespace + '"';
            }
            body += '>' + this._renderPropSet(properties) + '</d:mkcol>';
        }

        return this.request('MKCOL', url, headers, body).then((result) => {
            return {
                status: result.status,
                body: result.body,
                xhr: result.xhr
            };
        });
    }

    /**
     * Performs a HTTP request, and returns a Promise
     *
     * @param {string} method HTTP method
     * @param {string} url Relative or absolute url
     * @param {Object} headers HTTP headers as an object.
     * @param {string} body HTTP request body.
     * @return {Promise}
     */
    request(method, url, headers, body) {

        // This doesn't work with binary files in node.js and I don't know why.
        // Rather than try to debug XmlHttpRequest, I'm going to ignore it.

        let self = this;
        let xhr = new XMLHttpRequest();
        xhr.responseType = "arraybuffer"; // for binary data (does nothing in node.js)
        
        headers = headers || {};
        if (this.userName) {
            headers['Authorization'] = 'Basic ' + btoa(this.userName + ':' + this.password);
        }
        let turl = new URL(url, this.baseUrl).toString();
        xhr.open(method, turl, true);
        let ii;
        for(ii in headers) {
            xhr.setRequestHeader(ii, headers[ii]);
        }

        // Work around for edge
        if (body === undefined) {
            xhr.send();
        } else {
            xhr.send(body);
        }

        return new Promise(function(resolve, reject) {

            xhr.onreadystatechange = function() {
                if (xhr.readyState !== 4)
                    return;
            }
            
            xhr.onload = function() {
                let resultBody = xhr.response;
                if (xhr.status === 207)
                    resultBody = self.parseMultiStatus(resultBody);
                resolve({
                    body: resultBody,
                    status: xhr.status,
                    xhr: xhr
                });
            };

            xhr.ontimeout = function() {
                reject(new Error('Timeout exceeded'));
            };
        });
    }

    /**
     * Parses a property node.
     *
     * Either returns a string if the node only contains text, or returns an
     * array of non-text subnodes.
     *
     * @param {Object} propNode node to parse
     * @return {string|Array} text content as string or array of subnodes, excluding text nodes
     */
    _parsePropNode(propNode) {
        let content = null;
        if (propNode.childNodes && propNode.childNodes.length > 0) {
            let subNodes = [];
            // filter out text nodes
            for (let j = 0; j < propNode.childNodes.length; j++) {
                let node = propNode.childNodes[j];
                if (node.nodeType === 1) {
                    subNodes.push(node);
                }
            }
            if (subNodes.length) {
                content = subNodes;
            }
        }

        return content || propNode.textContent || propNode.text || '';
    }

    /**
     * Parses a multi-status response body.
     *
     * @param {string} xmlBody
     * @param {Array}
     */
    parseMultiStatus(xmlBody) {

        let parser = new DOMParser();
        let doc = parser.parseFromString(xmlBody, "application/xml");

        let resolver = function(foo) {
            let ii;
            for(ii in this.xmlNamespaces) {
                if (this.xmlNamespaces[ii] === foo) {
                    return ii;
                }
            }
        }.bind(this);

        let responseIterator = doc.evaluate('/d:multistatus/d:response', doc, resolver, XPathResult.ANY_TYPE, null);

        let result = [];
        let responseNode = responseIterator.iterateNext();

        while (responseNode) {

            let response = {
                href : null,
                propStat : []
            };

            response.href = doc.evaluate('string(d:href)', responseNode, resolver, XPathResult.ANY_TYPE, null).stringValue;

            let propStatIterator = doc.evaluate('d:propstat', responseNode, resolver, XPathResult.ANY_TYPE, null);
            let propStatNode = propStatIterator.iterateNext();

            while (propStatNode) {
                let propStat = {
                    status : doc.evaluate('string(d:status)', propStatNode, resolver, XPathResult.ANY_TYPE, null).stringValue,
                    properties : {},
                };

                let propIterator = doc.evaluate('d:prop/*', propStatNode, resolver, XPathResult.ANY_TYPE, null);

                let propNode = propIterator.iterateNext();
                while (propNode) {
                    let content = this._parsePropNode(propNode);
                    propStat.properties['{' + propNode.namespaceURI + '}' + propNode.localName] = content;
                    propNode = propIterator.iterateNext();

                }
                response.propStat.push(propStat);
                propStatNode = propStatIterator.iterateNext();


            }

            result.push(response);
            responseNode = responseIterator.iterateNext();

        }

        return result;

    }

    parseClarkNotation(propertyName) {

        let result = propertyName.match(/^{([^}]+)}(.*)$/);
        if (!result)
            return;

        return {
            name : result[2],
            namespace : result[1]
        };

    }
}

if (typeof module !== 'undefined')
    module.exports = WebDAVClient;
