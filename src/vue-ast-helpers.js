const t = require('babel-types');
const chalk = require('chalk');

const nestedPropsVisitor = {
    ObjectProperty (path) {
        const parentKey = path.parentPath.parent.key;
        if (parentKey && parentKey.name === this.childKey) {
            const key = path.node.key;
            const node = path.node.value;

            if (key.name === 'type') {
                if (t.isIdentifier(node)) {
                    this.collect.props[this.childKey].type = node.name.toLowerCase();
                } else {
                    console.log(chalk.red(`The type in ${this.childKey} prop only supports identifier, eg: Boolean, String`));
                }
            }

            if (t.isLiteral(node)) {
                if (key.name === 'default') {
                    this.collect.props[this.childKey].value = node.value;
                }

                if (key.name === 'required') {
                    this.collect.props[this.childKey].required = node.value;
                }
            }
        }
    },

    ArrowFunctionExpression (path) {
        const parentKey = path.parentPath.parentPath.parent.key;
        if (parentKey && parentKey.name === this.childKey) {
            const body = path.node.body;
            if (t.isArrayExpression(body)) {
                // Array
                this.collect.props[this.childKey].value = body;
            } else if (t.isBlockStatement(body)) {
                // Object/Block array
                const childNodes = body.body;
                if (childNodes.length === 1 && t.isReturnStatement(childNodes[0])) {
                    this.collect.props[this.childKey].value = childNodes[0].argument;
                }
            }

            // validator
            if (path.parent.key && path.parent.key.name === 'validator') {
                path.traverse({
                    ArrayExpression (path) {
                        this.collect.props[this.childKey].validator = path.node;
                    }
                }, { collect: this.collect, childKey: this.childKey });
            }
        }
    }
};

exports.collectVueProps = function collectVueProps (path, collect) {
    const childs = path.node.value.properties;
    const parentKey = path.node.key.name; // props;
    
    if (childs.length) {
        path.traverse({
            ObjectProperty (propPath) {
                const parentNode = propPath.parentPath.parent;
                if (parentNode.key && parentNode.key.name === parentKey) {
                    const childNode = propPath.node;
                    const childKey = childNode.key.name;
                    const childVal = childNode.value;

                    if (!collect.props[childKey]) {
                        if (t.isArrayExpression(childVal)) {
                            const elements = [];
                            childVal.elements.forEach(node => {
                                elements.push(node.name.toLowerCase());
                            });
                            collect.props[childKey] = {
                                type: elements.length > 1 ? 'typesOfArray' : elements[0] ? elements[0].toLowerCase() : elements,
                                value: elements.length > 1 ? elements : elements[0] ? elements[0] : elements,
                                required: false,
                                validator: false
                            };
                        } else if (t.isObjectExpression(childVal)) {
                            collect.props[childKey] = {
                                type: '',
                                value: undefined,
                                required: false,
                                validator: false
                            };
                            path.traverse(nestedPropsVisitor, { collect, childKey });
                        }
                    }
                }
            }
        });
    }
};