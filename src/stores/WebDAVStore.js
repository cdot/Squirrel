/*@preserve Copyright (C) 2018-2023 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env node,browser,jquery */

import { HttpServerStore } from "./HttpServerStore.js";

const XML_NAMESPACES = {
  'DAV:' : "d"
};

/**
 * Store on a remote WebDAV server
 * @extends HttpServerStore
 */
class WebDAVStore extends HttpServerStore {

	/**
	 * See {@link HttpServerStore} for other constructor options
	 */
  constructor(options) {
    super(options);
    this.type = "WebDAVStore";
  }

  /**
   * Override {@link HttpServerStore#request} to add 207 handling
   * @Override
	 */
  request(method, url, headers, body) {
    return super.request(method, url, headers, body)
    .then(res => {
      if (res.status === 207)
        res.body = this._parseMultiStatus(res.body);
      return res;
    });
  }

  /*UNUSED
   * Escape special characters in an XML string
   * @param {type} s string to exacpe
   * @return {string} escaped string

   static _escapeXml(s) {
   return s.replace(/[<>&"']/g, function (ch) {
   switch (ch) {
   case "<": return '&lt;';
   case ">": return '&gt;';
   case "&": return '&amp;';
   case """: return '&quot;';
   case "'": return '&apos;';
   }
   });
   }
  */

  /* UNUSED
     _parseClarkNotation(propertyName) {
     const result = propertyName.match(/^{([^}]+)}(.*)$/);
     if (!result)
     return;

     return {
     name : result[2],
     namespace : result[1]
     };
     }
  */

  /*UNUSED
   * Generates a propFind request.
   *
   * @param {string} url Url to do the propfind request on
   * @param {Array} properties List of properties to retrieve.
   * @param {string} depth "0", "1" or "infinity"
   * @param {Object} [headers] headers
   * @return {Promise}

   propFind(url, properties, depth, headers) {

   if(typeof depth === 'undefined') {
   depth = "0";
   }

   // depth header must be a string, in case a number was passed in
   depth = "" + depth;

   headers = headers || {};

   headers['Depth'] = depth;
   headers['Content-Type'] = 'application/xml; charset=utf-8';

   let body ='<?xml version="1.0"?><d:propfind ';
   let namespace;
   for (namespace in XML_NAMESPACES) {
   body += ' xmlns:' + XML_NAMESPACES[namespace] + '="' + namespace + """;
   }
   body += '><d:prop>';

   for (let ii in properties) {
   if (!Object.prototype.hasOwnProperty.call(properties, ii)) {
   continue;
   }

   const property = this._parseClarkNotation(properties[ii]);
   if (property && XML_NAMESPACES[property.namespace]) {
   body += "<" + XML_NAMESPACES[property.namespace] + ":" + property.name + ' />';
   } else {
   body += '<x:' + property.name + ' xmlns:x="' + property.namespace + '" />';
   }
   }
   body += '</d:prop></d:propfind>';

   return this
   .request('PROPFIND', url, headers, body)
   .then(result => {
   return {
   status: result.status,
   body: depth === "0" ? result.body[0] : result.body,
   xhr: result.xhr
   };
   });
   }
  */

  /*UNUSED
   * Renders a "d:set" block for the given properties.
   *
   * @param {Object.<String,String>} properties
   * @return {String} XML "<d:set>" block

   _renderPropSet(properties) {
   let body = '<d:set><d:prop>';

   for (let ii in properties) {
   if (!Object.prototype.hasOwnProperty.call(properties, ii))
   continue;

   let property = this._parseClarkNotation(ii);
   let propName;
   let propValue = properties[ii];
   if (XML_NAMESPACES[property.namespace]) {
   propName = XML_NAMESPACES[property.namespace] + ":" + property.name;
   } else {
   propName = 'x:' + property.name + ' xmlns:x="' + property.namespace + """;
   }

   // FIXME: hard-coded for now until we allow properties to
   // specify whether to be escaped or not
   if (propName !== 'd:resourcetype') {
   propValue = _escapeXml(propValue);
   }
   body += "<" + propName + ">" + propValue + '</' + propName + ">";
   }
   body += '</d:prop></d:set>';
   return body;
   }
  */

  /*UNUSED
   * Generates a propPatch request.
   *
   * @param {string} url Url to do the proppatch request on
   * @param {Object.<String,String>} properties List of properties to store.
   * @param {Object} [headers] headers
   * @return {Promise}

   propPatch(url, properties, headers) {
   headers = headers || {};

   headers['Content-Type'] = 'application/xml; charset=utf-8';

   let body =
   '<?xml version="1.0"?><d:propertyupdate ';
   let namespace;
   for (namespace in XML_NAMESPACES) {
   body += ' xmlns:' + XML_NAMESPACES[namespace] + '="' + namespace + """;
   }
   body += ">" + this._renderPropSet(properties) + '</d:propertyupdate>';

   return this.request('PROPPATCH', url, headers, body)
   .then(result => {
   return {
   status: result.status,
   body: result.body,
   xhr: result.xhr
   };
   });
   }
  */

  /*UNUSED
   * Generates a MKCOL request.
   * If attributes are given, it will use an extended MKCOL request.
   *
   * @param {string} url Url to do the request on
   * @param {Object.<String,String>} [properties] list of properties to store.
   * @param {Object} [headers] headers
   * @return {Promise}

   mkcol(url, properties, headers) {
   let body = "";
   headers = headers || {};
   headers['Content-Type'] = 'application/xml; charset=utf-8';

   if (properties) {
   body =
   '<?xml version="1.0"?><d:mkcol';
   let namespace;
   for (namespace in XML_NAMESPACES) {
   body += ' xmlns:' + XML_NAMESPACES[namespace] + '="' + namespace + """;
   }
   body += ">" + this._renderPropSet(properties) + '</d:mkcol>';
   }

   return this.request('MKCOL', url, headers, body).then(result => {
   return {
   status: result.status,
   body: result.body,
   xhr: result.xhr
   };
   });
   }
  */

  /**
   * Parses a property node.
   *
   * Either returns a string if the node only contains text, or returns an
   * array of non-text subnodes.
   *
   * @param {Object} propNode node to parse
   * @return {string|Array} text content as string or array of subnodes, excluding text nodes
	 * @private
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

    return content || propNode.textContent || propNode.text || "";
  }

  /**
   * Parses a multi-status response body.
   * @param {string} xmlBody
   * @return {Array} array of {href: string, propstat: object[]}
	 * @private
   */
  _parseMultiStatus(xmlBody) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlBody, "application/xml");

    const resolver = function(foo) {
      for (let i in XML_NAMESPACES) {
        if (foo === XML_NAMESPACES[i]) {
          return i;
        }
      }
			return undefined;
    }.bind(this);

    const responseIterator = doc.evaluate('/d:multistatus/d:response', doc, resolver, XPathResult.ANY_TYPE, null);

    const result = [];
    let responseNode = responseIterator.iterateNext();

    while (responseNode) {
      const response = {
        href : null,
        propStat : []
      };

      response.href = doc.evaluate('string(d:href)', responseNode, resolver, XPathResult.ANY_TYPE, null).stringValue;

      const propStatIterator = doc.evaluate('d:propstat', responseNode, resolver, XPathResult.ANY_TYPE, null);
      let propStatNode = propStatIterator.iterateNext();

      while (propStatNode) {
        const propStat = {
          status : doc.evaluate('string(d:status)', propStatNode, resolver, XPathResult.ANY_TYPE, null).stringValue,
          properties : {},
        };

        const propIterator = doc.evaluate('d:prop/*', propStatNode, resolver, XPathResult.ANY_TYPE, null);

        let propNode = propIterator.iterateNext();
        while (propNode) {
          const content = this._parsePropNode(propNode);
          propStat.properties["{" + propNode.namespaceURI + "}" + propNode.localName] = content;
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

  /**
   * @inheritdoc
   * @param {String} path folder URL relative to this.option("url")
	 */
  mkpath(path) {
    if (path.length === 0)
      return Promise.resolve(); // at the root, always exists

    return this.request('PROPFIND', path.join("/"), { Depth: 1 })
    .then(res => {
      if (200 <= res.status && res.status < 300)
        return Promise.resolve();

      if (res.status === 404) {
        const p = path.slice();
        p.pop();
        return this.mkpath(p).then(
          // Simple MKCOL request, no properties
					() => this.request('MKCOL', path.join("/")));
      }

      return this._handle_error(path, res)
      .then(() => this.mkpath(path));
    });
  }
}

export { WebDAVStore }
