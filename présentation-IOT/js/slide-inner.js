(function() {
    'use strict';

    function sendHeight() {
        try {
            const height =
                document.documentElement.scrollHeight || document.body.scrollHeight;
            window.parent.postMessage({
                    type: 'resize',
                    height: height,
                    url: window.location.href,
                },
                '*'
            );
        } catch (error) {
            console.error('向父页面发送高度时出错:', error);
        }
    }

    const POST_MESSAGE_EVENT_TYPE = {
        SlideElementClicked: 'SLIDE_ELEMENT_CLICKED',
        SlideSaveImageClicked: 'SLIDE_SAVE_IMAGE_CLICKED',
        SlideCancelImageClicked: 'SLIDE_CANCEL_IMAGE_CLICKED',
        SlideCancelEdit: 'SLIDE_CANCEL_EDIT',
        SlideUpdateHtml: 'SLIDE_UPDATE_HTML',
        SlideEditMode: 'SLIDE_EDIT_MODE',
        SlideSaveTextContent: 'SLIDE_SAVE_TEXT_CONTENT',
        SlideSaveTextStyle: 'SLIDE_SAVE_TEXT_STYLE',
        SlideRefreshIframe: 'SLIDE_REFRESH_IFRAME',
        SlideCancelHoverEdit: 'SLIDE_CANCEL_HOVER_EDIT',
        SlideNext: 'SLIDE_NEXT',
        SlidePrev: 'SLIDE_PREV',
        SlideAddPopover: 'SLIDE_ADD_POPOVER',
        SlideDeleteElement: 'SLIDE_DELETE_ELEMENT',
        SlideModifytImgStyle: 'SLIDE_MODIFY_IMG_STYLE',
        SlideModifyPosition: 'SLIDE_MODIFY_POSITION',
        SlideDuplicateElement: 'SLIDE_DUPLICATE_ELEMENT',
        SlideUndo: 'SLIDE_UNDO',
        SlideRedo: 'SLIDE_REDO',
        SlideUpdateUndoAndRedoStackLength: 'SLIDE_UPDATE_UNDO_AND_REDO_STACK_LENGTH',
        SlideDeleteElementUpdateHeight: 'SLIDE_DELETE_ELEMENT_UPDATE_HEIGHT'
    };

    const EDIT_SLIDE_CONSTANT = {
        ParentOriginList: [
            'http://localhost:3000',
            'https://www.coswift.ai',
            'https://www.genspark.ai',
            'https://*.i.coswift.ai',
            'https://*.genspark.space',
            'https://*.gensparkspace.com',
            'https://page.genspark.site',
            'https://page1.genspark.site',
        ],
        CurEleId: 'slide-edit-cur-ele-id',
        CurClickEleId: 'slide-edit-cur-click-ele-id',
        StyleId: 'slide-selected-style'
    };

    const EDIT_SLIDE_SELECTED_ATTR = {
        TextAndImg: 'data-slide-selected',
        ContainerClickSelected: 'item-slide-click-selected',
        ContainerSelected: 'item-slide-selected',
    };

    function postMessageToParent(data) {
        window.parent.postMessage(data, '*');
    }

    function getUniqueSelector(target) {
        if (!(target instanceof Element)) return null

        // Create description of the target element
        let elementDescription = getElementDescription(target);

        // Get path to the element
        const pathParts = [];
        let el = target.parentNode;
        while (el && el.nodeType === 1 && el !== document.documentElement) {
            const parent = el.parentNode;
            if (!parent) break

            const part = getPathPart(el);
            pathParts.unshift(part);
            el = parent;
        }

        const pathString = pathParts.length > 0 ? pathParts.join(' → ') : 'document';
        return `Element: ${elementDescription}\nPath: ${pathString}`

        // Helper function to get element description
        function getElementDescription(element) {
            const tag = element.tagName.toLowerCase();
            let desc = tag;

            // Add ID if available
            if (element.id) {
                desc += `#${element.id}`;
            }

            // Add classes if available
            if (element.classList && element.classList.length > 0) {
                const classStr = Array.from(element.classList).join('.');
                desc += `.${classStr}`;
            }

            // Add content description
            let contentDesc = '';

            // Check for text content
            const textContent = element.textContent ? .trim();
            if (textContent && textContent.length > 0) {
                const shortText =
                    textContent.length > 30 ?
                    textContent.substring(0, 30) + '...' :
                    textContent;
                contentDesc += ` content: "${shortText.replace(/"/g, '\\"')}"`;
            }

            // Check for alt text on images
            if (tag === 'img') {
                const src = element.getAttribute('src');
                const alt = element.getAttribute('alt');
                contentDesc += ` image${alt ? `: "${alt}"` : ''}`;
                if (src) {
                    const srcShort =
                        src.length > 20 ? src.substring(src.lastIndexOf('/') + 1) : src;
                    contentDesc += ` (${srcShort})`;
                }
            }

            // Check for input elements
            if (tag === 'input') {
                const type = element.type || 'text';
                const value = element.value ? `value: "${element.value}"` : '';
                contentDesc += ` ${type} input ${value}`;
            }

            const result = desc + contentDesc;
            console.log('getElementDescription result', result);
            return result
        }

        // Helper function to get path part
        function getPathPart(element) {
            const tag = element.tagName.toLowerCase();
            let part = tag;

            // Add ID if available
            if (element.id) {
                part += `#${element.id}`;
            }

            // Add classes if available
            if (element.classList && element.classList.length > 0) {
                const classStr = Array.from(element.classList).join('.');
                part += `.${classStr}`;
            }

            // Add position info
            const siblings = Array.from(element.parentNode.children);
            const sameTagSiblings = siblings.filter(s => s.tagName === element.tagName);

            if (sameTagSiblings.length > 1) {
                const index = sameTagSiblings.indexOf(element) + 1;
                part += ` (${index}th ${tag})`;
            }

            return part
        }
    }

    function isOriginAllowed(origin) {
        // 直接匹配
        if (EDIT_SLIDE_CONSTANT.ParentOriginList.includes(origin)) {
            return true
        }

        // 通配符匹配
        for (const pattern of EDIT_SLIDE_CONSTANT.ParentOriginList) {
            if (pattern.includes('*')) {
                const regexPattern = pattern.replace(/\./g, '\\.').replace(/\*/g, '.*');
                const regex = new RegExp(`^${regexPattern}$`);
                if (regex.test(origin)) {
                    return true
                }
            }
        }

        return false
    }

    function slideUpdateHtml() {
        let content = document.documentElement.outerHTML;
        const parser = new DOMParser();
        const doc = parser.parseFromString(content, 'text/html');
        const dom = doc.getElementById(EDIT_SLIDE_CONSTANT.CurEleId);
        if (dom) {
            dom.removeAttribute('data-slide-selected');
            dom.removeAttribute('id');
            dom.removeAttribute('item-slide-selected');
        }
        const domClick = doc.getElementById(EDIT_SLIDE_CONSTANT.CurClickEleId);
        if (domClick) {
            domClick.removeAttribute('data-slide-selected');
            domClick.removeAttribute('id');
            domClick.removeAttribute('item-slide-selected');
        }
        const domStyle = doc.getElementById(EDIT_SLIDE_CONSTANT.StyleId);
        if (domStyle) {
            domStyle.parentNode.removeChild(domStyle);
        }
        doc.querySelectorAll('[data-slide-selected]').forEach(item => {
            item.removeAttribute('data-slide-selected');
        });
        doc.querySelectorAll('[item-slide-click-selected]').forEach(item => {
            item.removeAttribute('item-slide-click-selected');
        });
        doc.querySelectorAll('[item-slide-selected]').forEach(item => {
            item.removeAttribute('item-slide-selected');
        });
        doc.querySelectorAll('[data-slide-hover-selected]').forEach(item => {
            item.removeAttribute('data-slide-hover-selected');
        });
        content = doc.documentElement.outerHTML;
        postMessageToParent({
            type: POST_MESSAGE_EVENT_TYPE.SlideUpdateHtml,
            payload: {
                iframeId: window.location.href,
                content: content,
            },
        });
    }

    function getTranslateXY(element) {
        const style = window.getComputedStyle(element);
        const transform =
            style.transform || style.webkitTransform || style.mozTransform;

        let translateX = 0;
        let translateY = 0;

        if (transform && transform !== 'none') {
            if (transform.startsWith('matrix3d')) {
                // 3D matrix
                const values = transform
                    .match(/^matrix3d\((.+)\)$/)[1]
                    .split(', ')
                    .map(parseFloat);
                translateX = values[12]; // 13th value
                translateY = values[13]; // 14th value
            } else if (transform.startsWith('matrix')) {
                // 2D matrix
                const values = transform
                    .match(/^matrix\((.+)\)$/)[1]
                    .split(', ')
                    .map(parseFloat);
                translateX = values[4]; // 5th value
                translateY = values[5]; // 6th value
            }
        }

        return {
            x: translateX,
            y: translateY
        }
    }

    function getHeight() {
        return document.documentElement.scrollHeight || document.body.scrollHeight
    }

    let isCanEditSlide = false;
    const undoStack = window.slideUndoStack || [];
    const redoStack = window.slideRedoStack || [];

    function slideSelectedStyle() {
        const style = document.createElement('style');
        style.setAttribute('id', EDIT_SLIDE_CONSTANT.StyleId);
        style.textContent = `
  [data-slide-selected]::before
  /* [data-slide-hover-selected]::before */ {
    content: '';
    position: absolute;
    top: -4px;
    left: -4px;
    width: 100%;
    height: 100%;
    box-sizing: content-box;
    padding: 4px;
    border-radius: 0px;
    outline: 2px solid #0f7fff !important;
    z-index: 10000;
    pointer-events: none;
  }

 /* [data-slide-hover-selected], */
  [data-slide-selected] {
    position: relative;
    outline: none;
    cursor: default;
  }

  img[data-slide-selected],
  img[data-slide-hover-selected],
  [data-slide-hover-selected],
  [item-slide-click-selected],
  [item-slide-selected] {
    border: 2px solid #0f7fff !important;
  }


`;
        document.head.appendChild(style);
    }


    function handlerImgEdit(target) {
        target.setAttribute(EDIT_SLIDE_SELECTED_ATTR.TextAndImg, true);
        target.setAttribute('id', EDIT_SLIDE_CONSTANT.CurClickEleId);

        postMessageToParent({
            type: POST_MESSAGE_EVENT_TYPE.SlideElementClicked,
            payload: {
                id: EDIT_SLIDE_CONSTANT.CurClickEleId,
                iframeId: window.location.href,
                elementType: 'img',
                attrs: {
                    src: target.getAttribute('src'),
                },
            },
        });

        addPopover('img');
    }

    function removeTextAttribute(target) {
        target.removeAttribute('data-slide-selected');
        target.removeAttribute('id');
        target.removeAttribute('item-slide-selected');
    }

    function removeImgAttribute(target) {
        target.removeAttribute('data-slide-selected');
        target.removeAttribute('id');
        target.removeAttribute('item-slide-selected');
    }


    function removeItemAttribute() {
        document.querySelectorAll('[item-slide-selected]').forEach(item => {
            item.removeAttribute('item-slide-selected');
        });
    }

    function removeItemClickAttribute() {
        document.querySelectorAll('[item-slide-click-selected]').forEach(item => {
            item.removeAttribute('item-slide-click-selected');
        });
    }

    function removeNoCurClickEleAttributes() {
        document.querySelectorAll('[data-slide-hover-selected]').forEach(item => {
            item.removeAttribute('data-slide-hover-selected');
        });
        removeItemAttribute();
    }

    function removeHoverSelectedEleAttributes() {
        document.querySelectorAll('[data-slide-hover-selected]').forEach(item => {
            item.removeAttribute('data-slide-hover-selected');
        });
        removeItemAttribute();
    }

    function removeSelectedEleAttributes() {
        removeHoverSelectedEleAttributes();
        const domClick = document.getElementById(EDIT_SLIDE_CONSTANT.CurClickEleId);
        if (domClick) {
            removeTextAttribute(domClick);
            removeImgAttribute(domClick);
        }
        document.querySelectorAll('[data-slide-selected]').forEach(item => {
            item.removeAttribute('data-slide-selected');
        });
        document.querySelectorAll('[data-slide-hover-selected]').forEach(item => {
            item.removeAttribute('data-slide-hover-selected');
        });
        removeItemAttribute();
        removeItemClickAttribute();
    }

    function addElementSelectedMouseover(target) {
        target.setAttribute('data-slide-hover-selected', true);
    }

    function handlerTextMouseover(target) {
        target.setAttribute('data-slide-hover-selected', true);
    }

    function handlerImgMouseover(target) {
        target.setAttribute('data-slide-hover-selected', true);
    }

    function captureElementToBase64(domElement) {
        // 检查输入
        if (!domElement || !(domElement instanceof Element)) {
            console.error('请提供有效的 DOM 元素');
            return;
        }

        // 创建一个新的 canvas 元素
        const canvas = document.createElement('canvas');
        canvas.getContext('2d');

        // 获取元素的尺寸和位置
        const rect = domElement.getBoundingClientRect();

        // 设置 canvas 的尺寸
        canvas.width = rect.width;
        canvas.height = rect.height;

        // 使用 html2canvas 将元素渲染到 canvas 上
        // 内联加载 html2canvas 库
        const script = document.createElement('script');
        script.src = 'https://html2canvas.hertzen.com/dist/html2canvas.min.js';
        script.onload = function() {
            html2canvas(document.documentElement, {
                backgroundColor: null,
                scale: window.devicePixelRatio, // 考虑设备像素比
                logging: false,
                useCORS: true, // 尝试处理跨域图片
                allowTaint: true,
                onclone: function(clonedDoc) {
                    console.log('onclone', clonedDoc);
                    clonedDoc.querySelectorAll('[item-slide-click-selected]').forEach(item => {
                        item.removeAttribute('item-slide-click-selected');
                    });
                    clonedDoc.querySelectorAll('[item-slide-selected]').forEach(item => {
                        item.removeAttribute('item-slide-selected');
                    });
                }
            }).then(renderedCanvas => {
                const scale = +(new URLSearchParams(window.location.search).get('scale')) || 1;
                console.log('scale', scale);
                const rect = domElement.getBoundingClientRect();
                const left = rect.left / scale;
                const top = rect.top / scale;
                const width = rect.width / scale;
                const height = rect.height / scale;

                console.log('renderedCanvas', left, top, width, height);

                const croppedCanvas = document.createElement('canvas');
                croppedCanvas.width = width;
                croppedCanvas.height = height;
                const ctx = croppedCanvas.getContext('2d');
                ctx.drawImage(renderedCanvas, left, top, width, height, 0, 0, width, height);
                const base64Image = croppedCanvas.toDataURL('image/jpeg', 0.7);
                postMessageToParent({
                    type: POST_MESSAGE_EVENT_TYPE.SlideElementClicked,
                    payload: {
                        iframeId: window.location.href,
                        elementType: 'container',
                        base64: base64Image,
                    },
                });
            });

            // html2canvas(domElement, {
            //     backgroundColor: null,
            //     scale: window.devicePixelRatio, // 考虑设备像素比
            //     logging: false,
            //     useCORS: true, // 尝试处理跨域图片
            //     allowTaint: true,
            //     onclone: function (clonedDoc) {
            //       console.log('onclone', clonedDoc)
            //       clonedDoc.querySelectorAll('[item-slide-click-selected]').forEach(item => {
            //         item.removeAttribute('item-slide-click-selected')
            //       })
            //       clonedDoc.querySelectorAll('[item-slide-selected]').forEach(item => {
            //         item.removeAttribute('item-slide-selected')
            //       })
            //     }
            // }).then(renderedCanvas => {
            //     const base64Image = renderedCanvas.toDataURL('image/jpeg', 0.7);
            //     postMessageToParent({
            //       type: POST_MESSAGE_EVENT_TYPE.SlideElementClicked,
            //       payload: {
            //         iframeId: window.location.href,
            //         elementType: 'container',
            //         base64: base64Image,
            //       },
            //     })
            // }).catch(err => {
            //     console.error('截图过程中出错:', err);
            // });
        };

        script.onerror = function() {
            console.error('无法加载 html2canvas 库');
        };

        document.head.appendChild(script);
    }

    function addElementSelectedClick(target) {
        target.setAttribute('item-slide-click-selected', true);
        postMessageToParent({
            type: POST_MESSAGE_EVENT_TYPE.SlideElementClicked,
            payload: {
                iframeId: window.location.href,
                elementType: 'container',
                domPath: getUniqueSelector(target)
            },
        });
        captureElementToBase64(target);
        addPopover('container');
    }

    async function addPopover(elementType) {
        // 获取目标元素
        let target = document.querySelector('[data-slide-selected]');
        if (elementType === 'container') {
            target = document.querySelector('[item-slide-click-selected]');
        }
        if (!target) return;

        // 计算位置
        const rect = target.getBoundingClientRect();
        const scrollLeft = Math.max(document.documentElement.scrollLeft, document.body.scrollLeft);
        const scrollTop = Math.max(document.documentElement.scrollTop, document.body.scrollTop);

        const style = getComputedStyle(target);
        const {
            x,
            y
        } = getTranslateXY(target);

        postMessageToParent({
            type: POST_MESSAGE_EVENT_TYPE.SlideAddPopover,
            payload: {
                iframeId: window.location.href,
                elementType: elementType,
                attrs: {
                    style: {
                        left: rect.left + scrollLeft,
                        top: rect.top + scrollTop,
                        width: rect.width,
                        height: rect.height,
                        objectFit: style.objectFit,
                        transformX: x,
                        transformY: y,
                    }
                }
            }
        });
    }

    async function handlerTextClickEdit(target) {
        const hasTextNode = Array.from(target.childNodes).some(
            node => node.nodeType === Node.TEXT_NODE && node.textContent.trim()
        );
        if (!hasTextNode) {
            addElementSelectedClick(target);
            return
        }
        target.setAttribute(EDIT_SLIDE_SELECTED_ATTR.TextAndImg, true);
        syncSelectStyle(POST_MESSAGE_EVENT_TYPE.SlideElementClicked, 'text');
        addPopover('text');
    }

    function hanlderElementMouseover(event) {
        if (!isCanEditSlide) {
            return
        }

        const target = event.target;
        removeNoCurClickEleAttributes();

        if (target.textContent && target.textContent.trim().length > 0) {
            handlerTextMouseover(target);
        } else if (target.tagName === 'IMG') {
            handlerImgMouseover(target);
        } else if (target) {
            addElementSelectedMouseover(target);
        }
    }

    function hanlderElementClick(event) {
        if (!isCanEditSlide) {
            return
        }
        const target = event.target;
        removeSelectedEleAttributes();

        if (target.textContent && target.textContent.trim().length > 0) {
            handlerTextClickEdit(target);
        } else if (target.tagName === 'IMG') {
            handlerImgEdit(target);
        } else if (target) {
            addElementSelectedClick(target);
        }
    }

    function hanlderMessage(event) {
        if (!isOriginAllowed(event.origin)) {
            return
        }

        if (event.data.type === POST_MESSAGE_EVENT_TYPE.SlideEditMode) {
            isCanEditSlide = event.data.payload.isCanEditSlide;
            if (!isCanEditSlide) {
                removeSelectedEleAttributes();
            }
        }

        if (event.data.type === POST_MESSAGE_EVENT_TYPE.SlideSaveTextContent) {
            let dom = document.querySelector('[data-slide-selected]');
            if (dom) {
                dom.textContent = event.data.payload.attrs.text;
                slideUpdateHtml();
            }
        }

        if (event.data.type === POST_MESSAGE_EVENT_TYPE.SlideSaveImageClicked) {
            let img = document.getElementById(EDIT_SLIDE_CONSTANT.CurClickEleId);
            if (img) {
                addUndoStack();
                img.setAttribute('src', event.data.payload.attrs.src);
                slideUpdateHtml();
            }
        }
        if (event.data.type === POST_MESSAGE_EVENT_TYPE.SlideCancelImageClicked) {
            document.getElementById(EDIT_SLIDE_CONSTANT.CurClickEleId);
            removeSelectedEleAttributes();
        }
        if (event.data.type === POST_MESSAGE_EVENT_TYPE.SlideCancelEdit) {
            document.querySelectorAll('[data-slide-selected]').forEach(item => {
                item.removeAttribute('data-slide-selected');
            });
            document.querySelectorAll('[data-slide-hover-selected]').forEach(item => {
                item.removeAttribute('data-slide-hover-selected');
            });
            document.getElementById(EDIT_SLIDE_CONSTANT.CurClickEleId);
            removeSelectedEleAttributes();
        }
        if (event.data.type === POST_MESSAGE_EVENT_TYPE.SlideCancelHoverEdit) {
            removeHoverSelectedEleAttributes();
        }

        if (event.data.type === POST_MESSAGE_EVENT_TYPE.SlideSaveTextStyle) {
            const dom = document.querySelector('[data-slide-selected]');
            if (dom) {
                addUndoStack();
                if (event.data.payload.attrs.style.fontFamily) {
                    dom.style.fontFamily = event.data.payload.attrs.style.fontFamily;
                }
                if (event.data.payload.attrs.style.fontSize) {
                    dom.style.fontSize = event.data.payload.attrs.style.fontSize;
                }
                if (event.data.payload.attrs.style.fontWeight) {
                    dom.style.fontWeight = event.data.payload.attrs.style.fontWeight;
                }
                if (event.data.payload.attrs.style.textDecoration) {
                    dom.style.textDecoration = event.data.payload.attrs.style.textDecoration;
                }
                if (event.data.payload.attrs.style.fontStyle) {
                    dom.style.fontStyle = event.data.payload.attrs.style.fontStyle;
                }
                if (event.data.payload.attrs.style.color) {
                    dom.style.color = event.data.payload.attrs.style.color;
                }
                if (event.data.payload.attrs.style.textAlign) {
                    dom.style.textAlign = event.data.payload.attrs.style.textAlign;
                }
                slideUpdateHtml();
            }
        }

        if (event.data.type === POST_MESSAGE_EVENT_TYPE.SlideDeleteElement) {
            let target = null;
            if (event.data.payload.elementType !== 'container') {
                target = document.querySelector('[data-slide-selected]');
            } else {
                target = document.querySelector('[item-slide-click-selected]');
            }
            if (target) {
                addUndoStack();
                target.parentNode.removeChild(target);
                slideUpdateHtml();
                postMessageToParent({
                    type: POST_MESSAGE_EVENT_TYPE.SlideDeleteElementUpdateHeight,
                    payload: {
                        iframeId: window.location.href,
                        height: getHeight(),
                    },
                });
            }
        }

        if (event.data.type === POST_MESSAGE_EVENT_TYPE.SlideModifytImgStyle) {
            const target = document.querySelector('[data-slide-selected]');
            if (target) {
                addUndoStack();
                target.style.objectFit = event.data.payload.attrs.style.objectFit;
                if (event.data.payload.attrs.style.height) {
                    target.style.height = event.data.payload.attrs.style.height;
                }
                if (event.data.payload.attrs.style.width) {
                    target.style.width = event.data.payload.attrs.style.width;
                }
                slideUpdateHtml();
            }
        }

        if (event.data.type === POST_MESSAGE_EVENT_TYPE.SlideModifyPosition) {
            isCanEditSlide = false;
            const target = document.querySelector('[data-slide-selected]');
            if (target) {
                target.style.transform = `translate(${event.data.payload.attrs.style.transformX}px, ${event.data.payload.attrs.style.transformY}px)`;
                target.style.width = event.data.payload.attrs.style.width;
                target.style.height = event.data.payload.attrs.style.height;

                slideUpdateHtml();
            }
        }

        if (event.data.type === POST_MESSAGE_EVENT_TYPE.SlideDuplicateElement) {
            let target = document.querySelector('[data-slide-selected]');
            if (!target) {
                target = document.querySelector('[item-slide-click-selected]');
            }

            if (target) {
                addUndoStack();
                const newElement = target.cloneNode(true);
                newElement.removeAttribute('data-slide-selected');
                newElement.removeAttribute('item-slide-click-selected');
                target.parentNode.insertBefore(newElement, target.nextSibling);
                slideUpdateHtml();
            }
        }

        if (event.data.type === POST_MESSAGE_EVENT_TYPE.SlideUndo) {
            console.log('undoStack', undoStack);
            popUndoStack();
        }

        if (event.data.type === POST_MESSAGE_EVENT_TYPE.SlideRedo) {
            console.log('redoStack', redoStack);
            popRedoStack();
        }

        // 处理父页面调用子页面函数的消息
        if (event.data.type === 'PARENT_CALL_FUNCTION') {
            console.log('PARENT_CALL_FUNCTION', event.data);
            const {
                functionName,
                args = [],
                callbackId
            } = event.data.payload || {};

            // 可被父页面调用的函数列表
            const exposedFunctions = {
                getHeight,
                // 可以继续添加其他想要暴露给父页面的函数
            };

            if (exposedFunctions[functionName]) {
                try {
                    // 执行被调用的函数
                    const result = exposedFunctions[functionName](...args);

                    // 向父页面返回执行结果
                    if (callbackId) {
                        postMessageToParent({
                            type: 'PARENT_CALL_FUNCTION_RESPONSE',
                            payload: {
                                callbackId,
                                success: true,
                                result,
                            },
                        });
                    }
                } catch (error) {
                    console.error(`执行函数 ${functionName} 时出错:`, error);

                    // 向父页面返回错误信息
                    if (callbackId) {
                        postMessageToParent({
                            type: 'PARENT_CALL_FUNCTION_RESPONSE',
                            payload: {
                                callbackId,
                                success: false,
                                error: error.message,
                            },
                        });
                    }
                }
            }
        }

        if (event.data.type === POST_MESSAGE_EVENT_TYPE.SlideRefreshIframe) {
            window.location.reload();
        }
    }

    function syncSelectStyle(type, elementType) {
        const target = document.querySelector('[data-slide-selected]');
        const style = getComputedStyle(target);
        const rect = target.getBoundingClientRect();
        const {
            x,
            y
        } = getTranslateXY(target);
        postMessageToParent({
            type: type,
            payload: {
                id: EDIT_SLIDE_CONSTANT.CurClickEleId,
                iframeId: window.location.href,
                elementType: elementType,
                attrs: {
                    text: target.textContent,
                    style: {
                        left: rect.left,
                        top: rect.top,
                        width: rect.width,
                        height: rect.height,
                        fontFamily: style.fontFamily,
                        fontSize: style.fontSize,
                        fontWeight: style.fontWeight,
                        textDecoration: style.textDecorationLine,
                        fontStyle: style.fontStyle,
                        color: style.color,
                        textAlign: style.textAlign,
                        fontColor: style.color,
                        transformX: x,
                        transformY: y,
                        objectFit: style.objectFit
                    }
                },
            },
        });
    }

    function slideUpdateUndoAndRedoStackLength() {
        postMessageToParent({
            type: POST_MESSAGE_EVENT_TYPE.SlideUpdateUndoAndRedoStackLength,
            payload: {
                iframeId: window.location.href,
                undoStackLength: undoStack.length,
                redoStackLength: redoStack.length,
            },
        });
    }

    function popUndoStack() {
        if (undoStack.length > 0) {
            const currentHtml = document.body.innerHTML;
            const lastHtml = undoStack.pop();
            document.body.innerHTML = lastHtml;
            window.slideUndoStack = undoStack || [];
            // Save current state to redo stack
            redoStack.push(currentHtml);
            window.slideRedoStack = redoStack || [];
            slideUpdateHtml();
            slideUpdateUndoAndRedoStackLength();
        }
    }

    function popRedoStack() {
        if (redoStack.length > 0) {
            const currentHtml = document.body.innerHTML;
            const lastHtml = redoStack.pop();
            document.body.innerHTML = lastHtml;
            window.slideRedoStack = redoStack || [];
            // Save current state to undo stack
            undoStack.push(currentHtml);
            window.slideUndoStack = undoStack || [];
            slideUpdateHtml();
            slideUpdateUndoAndRedoStackLength();
        }
    }

    function addUndoStack() {
        let html = document.body.outerHTML;
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        doc.querySelectorAll('[data-slide-selected]').forEach(item => {
            item.removeAttribute(EDIT_SLIDE_SELECTED_ATTR.TextAndImg);
        });
        doc.querySelectorAll('[item-slide-click-selected]').forEach(item => {
            item.removeAttribute(EDIT_SLIDE_SELECTED_ATTR.ContainerClickSelected);
        });
        doc.querySelectorAll('[item-slide-selected]').forEach(item => {
            item.removeAttribute(EDIT_SLIDE_SELECTED_ATTR.ContainerSelected);
        });
        html = doc.body.innerHTML;
        undoStack.push(html);
        window.slideUndoStack = undoStack || [];
        // Clear redo stack when new changes are made
        redoStack.length = 0;
        window.slideRedoStack = redoStack || [];

        slideUpdateUndoAndRedoStackLength();
    }

    function slideEidtPostMessage() {
        document.addEventListener('mouseover', hanlderElementMouseover);
        document.addEventListener('click', hanlderElementClick);
        window.addEventListener('message', hanlderMessage);
    }

    function slideSelectedEdit() {
        slideSelectedStyle();
        slideEidtPostMessage();
    }

    function hanlderWheel(event) {
        if (event.deltaY > 20) {
            postMessageToParent({
                type: POST_MESSAGE_EVENT_TYPE.SlideNext
            });
        }
        if (event.deltaY < -20) {
            postMessageToParent({
                type: POST_MESSAGE_EVENT_TYPE.SlidePrev
            });
        }
    }

    function hanlderKeyDown(event) {
        if (event.key === 'ArrowRight') {
            postMessageToParent({
                type: POST_MESSAGE_EVENT_TYPE.SlideNext
            });
        }
        if (event.key === 'ArrowLeft') {
            postMessageToParent({
                type: POST_MESSAGE_EVENT_TYPE.SlidePrev
            });
        }
    }

    window.addEventListener('load', sendHeight);
    window.addEventListener('resize', sendHeight);
    document.addEventListener('wheel', hanlderWheel);
    document.addEventListener('keydown', hanlderKeyDown);

    sendHeight();
    slideSelectedEdit();

})();