/*@preserve Copyright (C) 2021-2023 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser */

/**
 * Move To dialog
 */
import { Dialog } from "../Dialog.js";

const PATH_SEPARATOR = "↘";

/**
 * Move node dialog.
 * See {@link Dialog} for constructor parameters.
 * @extends Dialog
 */
class MoveToDialog extends Dialog {

  onOK() {
    return this.target;
  }

  onOpened() {
		this.moving = this.options.path.slice();
		this.originalParent = this.options.path.slice(0, -1);
		this.target = this.options.path.slice();
		this.$control("parent")
		.on("click", () => {
			if (this.target.length > 0)
				this.target.pop();
			this._updatePath();
		});
		if (this.target.length > 0) {
			this.target.pop();
		}
		this._updatePath();
  }

	_is(path, other) {
		return (path.join(PATH_SEPARATOR) ===
					  other.join(PATH_SEPARATOR));
	}

	_updatePath() {			
    if (this.target.length === 0) {
			// Can't go up
			this.$control("parent")
			.prop("disabled", true)
			.css("opacity", 0.50);
			this.$control("folder-name").text("");
		} else {
			this.$control("parent")
			.prop("disabled", false)
			.css("opacity", 1);
			this.$control("folder-name").text(
				this.target[this.target.length - 1]);
		}
		if (this._is(this.target, this.originalParent)) {
			// Don't select origin folder
			this.$control('ok')
			.prop("disabled", true)
			.css('opacity', 0.5);
		} else {
			this.$control('ok')
			.prop("disabled", false)
			.css('opacity', 1);
		}
		const content = this.options.getContent(this.target);
    const $sf = this.$control("subfolders");
		$sf.empty();
    const template = this.$control("row-template").html();
    Object.keys(content).sort().map(name => {
      const $row = $(template.replace(/\$1/g, name))
					  .appendTo($sf);
			if (content[name]) {
				if (this._is(this.target.concat([name]), this.moving))
					// Don't select self
					$row.addClass("greyed");
				else { 
					$row
					.find("td")
					.on('click', () => {
						this.target.push(name);
						this._updatePath();
					});
				}
			}
			else {
				// Not a folder
				$row.find('.ui-icon').remove();
				$row.addClass("greyed");
			}
    });
	}
}

export { MoveToDialog }
