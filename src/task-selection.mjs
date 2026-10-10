class TaskSelection {
  tasks = [];
  cursor = 0;
  defaultTracked = true;
  exceptions = /* @__PURE__ */ new Set();
  constructor(state) {
    if (state) {
      this.defaultTracked = state.defaultTracked;
      this.exceptions = new Set(state.exceptions);
    }
  }
  snapshot() {
    return { defaultTracked: this.defaultTracked, exceptions: [...this.exceptions] };
  }
  update(tasks) {
    const focused = this.tasks[this.cursor]?.id;
    this.tasks = tasks;
    const index = tasks.findIndex((task) => task.id === focused);
    this.cursor = index >= 0 ? index : Math.min(this.cursor, Math.max(0, tasks.length - 1));
  }
  isTracked(id) {
    return this.defaultTracked !== this.exceptions.has(id);
  }
  get tracked() {
    return this.tasks.filter((task) => this.isTracked(task.id));
  }
  key(name) {
    if (name === "up") this.cursor = Math.max(0, this.cursor - 1);
    else if (name === "down") this.cursor = Math.min(Math.max(0, this.tasks.length - 1), this.cursor + 1);
    else if (name === "space") {
      const id = this.tasks[this.cursor]?.id;
      if (id) {
        if (this.exceptions.has(id)) this.exceptions.delete(id);
        else this.exceptions.add(id);
      }
    } else if (name === "a" || name === "n") {
      this.defaultTracked = name === "a";
      this.exceptions.clear();
    } else return false;
    return true;
  }
}
export {
  TaskSelection
};
