import { Component } from './component.js';

class Bulb extends Component {
    constructor(id, start, end) {
        super(id, 'bulb', start, end, 'src/components/lamp.png', true);
        this.is_on = true;
    }

    // turnOn(){
    //     this.is_on = true;
    //     console.log(`💡 Bulb ${this.id} is now ON.`);
    // }

    // turnOff(){
    //     this.is_on = false;
    //     console.log(`💡 Bulb ${this.id} is now OFF.`);
    // }
}

export { Bulb };