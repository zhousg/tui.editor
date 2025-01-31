# 🎨 Custom HTML Renderer

The TOAST UI Editor (henceforth referred to as 'Editor') provides a way to customize the final HTML contents.

The Editor uses its own markdown parser called `ToastMark`, which has two steps for converting markdown text to HTML text. The first step is converting markdown text into AST(Abstract Syntax Tree), and the second step is generating HTML text from the AST. Although it's tricky to customize the first step, the second step can be easily customized by providing a set of functions that convert a certain type of node to HTML string.

## Basic Usage

The Editor accepts the `customHTMLRenderer` option, which is a key-value object. The keys of the object is types of node of the AST, and the values are convertor functions to be used for converting a node to a list of tokens.

The following code is a basic example of using `customHTMLRenderer` option.

```js
const editor = new Editor({
  el: document.querySelector('#editor'),
  customHTMLRenderer: {
    heading(node, context) {
      return {
        type: context.entering ? 'openTag' : 'closeTag',
        tagName: 'div',
        classNames: [`heading-${node.level}`]
      };
    },
    text(node, context) {
      const strongContent = node.parent.type === 'strong';
      return {
        type: 'text',
        content: strongContent ? node.literal.toUpperCase() : node.literal
      };
    },
    linebreak(node, context) {
      return {
        type: 'html',
        content: '\n<br />\n'
      };
    }
  }
});
```

If we set the following markdown content,

```markdown
## Heading

Hello
World
```

The final HTML content will be like below.

```html
<div class="heading-2">HEADING</div>
<p>Hello<br /><br />World</p>
```

## Tokens

As you can see in the basic example above, each convertor function returns a token object instead of returning HTML string directly. The token objects are converted to HTML string automatically by internal module. The reason we use tokens instead of HTML string is that tokens are much easier to reuse as they contain structural information which can be used by overriding functions.

There are four token types available for the token objects, which are `openTag`, `closeTag`, `text`, and `html`.

### openTag

The `openTag` type token represents an opening tag string. A `openTag` type token has `tagName`, `attributes`, `classNames` properties to specify the data for generating HTML string. For example, following token object,

```js
{
  type: 'openTag',
  tagName: 'a',
  classNames: ['my-class1', 'my-class2']
  attributes: {
    target: '_blank',
    href: 'http://ui.toast.com'
  }
}
```

is converted to the HTML string below.

```html
<a class="my-class1 my-class2" href="http://ui.toast.com" target="_blank"></a>
```

To specify self-closing tags like `<br />`, and `<hr />` , you can use `selfClose` options like below.

```js
{
  type: 'openTag',
  tagName: 'br',
  classNames: ['my-class'],
  selfClose: true
}
```

```html
<br class="my-class" />
```

### closeTag

The `closeTag` type token represents a closing tag string. A `closeTag` type token does not contain additional information other than `tagName`.

```js
{
  type: 'closeTag',
  tagName: 'a'
}
```

```html
</a>
```

### text

The `text` type token represents a plain text string. This token only has a `content` property and HTML characters in the value are escaped in the converted string.

```js
{
  type: 'text',
  content: '<br />'
}
```

```html
&lt;br /&gt;
```

### html

The `html` type token represents a raw HTML string. Like the `text` type token, this token also has `content` property and the value is used as is without modification.

```js
{
  type: 'html',
  content: '<br />'
}
```

```html
<br />
```

## Node

The first parameter of a convertor function is a `Node` type object which is the main element of the AST(Abstract Syntax Tree) constructed by the ToastMark. Every node has common properties for constructing a tree, such as `parent`, `firstChild`, `lastChild`, `prev`, and `next`.

In addition, each node has its own properties based on its type. For example, a `heading` type node has `level` property to represent the level of heading, and a `link` type node has a `destination` property to represent the URL of the link.

The following markdown text and AST tree object will help you understand the structure of AST generated by the ToastMark.

```md
## TOAST UI

**Hello** World!
```

```js
{
  type: 'document',
  firstChild: {
    type: 'heading',
    level: 2,
    parent: //[document node],
    firstChild:
      type: 'text',
      parent: //[heading node],
      literal: 'TOAST UI'
    },
    next: {
      type: 'paragraph',
      parent: //[document node],
      firstChild: {
        type: 'strong',
        parent: //[paragraph node],
        firstChild: {
          type: 'text',
          parent: //[strong node],
          literal: 'Hello'
        },
        next: {
          type: 'text',
          parent: //[paragraph node],
          literal: 'World !'
        }
      }
    }
  }
}
```

The type definition of each node can be found in the [source code](https://github.com/nhn/tui.editor/blob/master/libs/toastmark/src/commonmark/node.ts).

## Context

When the Editor tries to generate HTML string using an AST, every node in the AST is traversed in pre-order fashion. Whenever a node is visited, a convertor function of which the key is the same as the type of the node is invoked. At this point, a context object is given to the convertor function as a second parameter.

### entering

Every node in an AST except leaf nodes is visited twice during a traversal. The fisrt time when the node is visited, and the second time after all the children of the node are visited. We can determine in which pace the convertor is invoked using `entering` property of the context object.

The following code is a typical example using `entering` property.

```js
const editor = new Editor({
  el: document.querySelector('#editor'),
  customHTMLRenderer: {
    heading({ level }, { entering }) {
      return {
        type: entering ? 'openTag' : 'closeTag',
        tagName: `h${level}`
      };
    },
    text({ literal }) {
      return {
        type: 'text',
        content: node.literal
      };
    }
  }
});
```

The `heading` convertor function is using `context.entering` to determin the type of returning token object. The type is `openTag` when the value is `true`, otherwise is `closeTag`. The `text` convertor function doens't need to use `entering` property as it is invoked only once for the first visit.

Now, if we set the following markdown text to the editor,

```markdown
# TOAST UI
```

The AST genereted by ToastMark will be like below. (only essential properties are specified)

```js
{
  type: 'document',
  firstChild: {
    type: 'heading',
    level: 1,
    firstChild: {
      type: 'text',
      literal: 'TOAST UI'
    }
  }
}
```

After finishing a traversal, tokens returned by convertor functions are stored in an array like below.

```js
[
  { type: 'openTag', tagName: 'h1' },
  { type: 'text', content: 'TOAST UI' },
  { type: 'closeTag', tagName: 'h1' }
];
```

Finally, the array of token is converted to HTML string.

```html
<h1>TOAST UI</h1>
```

### origin()

If we want to use original convertor function inside the overriding function, we can use `origin()` function.

For example, if the return value of original convertor function for `link` node is like below,

#### entering: true

```js
{
  type: 'openTag',
  tagName: 'a',
  attributes: {
    href: 'http://ui.toast.com',
    title: 'TOAST UI'
  }
}
```

#### entering: false

```js
{
  type: 'closeTag',
  tagName: 'a'
}
```

The following code will set `target="_blank"` attribute to the result object only when `entering` state is `true`.

```js
const editor = new Editor({
  el: document.querySelector('#editor'),
  customHTMLRenderer: {
    link(node, context) {
      const { origin, entering } = context;
      const result = origin();
      if (entering) {
        result.attributes.target = '_blank';
      }
      return result;
    }
  },
}
```

#### entering: true

```js
{
  type: 'openTag',
  tagName: 'a',
  attributes: {
    href: 'http://ui.toast.com',
    target: '_blank',
    title: 'TOAST UI'
  }
}
```

## Advanced Usage

### getChildrenText()

In a normal situation, a node doesn't need to care about it's children as their content will be handled by their own convertor functions. However, sometimes a node needs to get the children content to set the value of it's attribute. For this use case, a `context` object provides the `getChildrenText()` function.

For example, if a heading element wants to set it's `id` based on its children content, we can use the `getChildrenText()` function like the code below.

```js
const editor = new Editor({
  el: document.querySelector('#editor'),
  customHTMLRenderer: {
    heading({ level }, { entering, getChildrenText }) {
      const tagName = `h${level}`;

      if (entering) {
        return {
          type: 'openTag',
          tagName,
          attributes: {
            id: getChildrenText(node)
              .trim()
              .replace(/\s+/g, '-')
          }
        };
      }
      return { type: 'closeTag', tagName };
    }
  }
});
```

Now, if we set the markdown text below,

```markdown
# Hello _World_
```

The return value of `getChildrenText()` inside the `heading` convertor function will be `Hello World`. As we are replacing white spaces into `-`, the final HTML string through the custom renderer will be like below.

```html
<h1 id="Hello-World">Hello <em>World</em></h1>
```

### skipChildren()

The `skipChildren()` function skips traversal of child nodes. This function is useful when we want to use the content of children only for the attribute of current node, instead of generating child elements.

For example, `image` node has children which represents the description of the image. However, if we want to use an `img` element for representing a `image` node, we can't use child elements as an `img` element cannot have children. In this case, we need to invoke `skipChildren()` to prevent child nodes from being converted to additional HTML string. Instead, we can use `getChildrenText()` to get the text content of children, and set it to the `alt` attribute.

The following code example is an simplified version of built-in convertor function for an `image` type node.

```js
function image(node, context) {
  const { destination } = node;
  const { getChildrenText, skipChildren } = context;

  skipChildren();

  return {
    type: 'openTag',
    tagName: 'img',
    selfClose: true,
    attributes: {
      src: destination,
      alt: getChildrenText(node)
    }
  };
}
```

### Using Multiple Tags for a Node

A convertor function can also returns an array of token object. This is useful when we want to convert a node to nested elements. The following code example shows how to convert a `codeBlock` node to `<pre><code>...</code></pre>` tag string.

```js
function codeBlock(node) {
  return [
    { type: 'openTag', tagName: 'pre', classNames: ['code-block'] },
    { type: 'openTag', tagName: 'code' },
    { type: 'text', content: node.literal },
    { type: 'closeTag', tagName: 'code' },
    { type: 'closeTag', tagName: 'pre' }
  ];
}
```

### Controlling Newlines

In a normal situation, we don't need to care about formatting of converted HTML string. However, as the ToastMark support [CommonMark Spec](https://spec.commonmark.org/0.29/), the renderer supports an option to control new-lines to pass the [official test cases](https://spec.commonmark.org/0.29/spec.json).

The `outerNewline` and `innerNewline` property can be added to token objects to control white spaces. The following example will help you understand how to use these properties.

#### Token Array

```js
[
  {
    type: 'text',
    content: 'Hello'
  },
  {
    type: 'openTag',
    tagName: 'p',
    outerNewLine: true,
    innerNewLine: true
  },
  {
    type: 'html',
    content: '<strong>My</strong>'
    outerNewLine: true,
  },
  {
    type: 'closeTag',
    tagName: 'p',
    innerNewLine: true
  },
  {
    type: 'text',
    content: 'World'
  }
]
```

#### Converted HTML string

```html
Hello
<p>
  <strong>My</strong>
</p>
World
```

As you can see in the example above, `outerNewLine` of `openTag` adds `\n` before the tag string, whereas one of `closeTag` adds `\n` after the tag string. In contrast, `innerNewLine` of `openTag` adds `\n` after the tag string, whereas one of `closeTag` adds `\n` before the tag string. In addition, consecutive newlines are merged into one newline to prevent duplication.
