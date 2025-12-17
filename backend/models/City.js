import mongoose from "mongoose";

const citySchema = new mongoose.Schema({
  city: { type: String, required: true },
  lat: { type: Number, required: true },
  lng: { type: Number, required: true }
});

export default mongoose.model("City", citySchema, "cities"); 

