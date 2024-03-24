////////////////////////////
import Dbc from "dbc-can";
import fs from "fs";
const dbc = new Dbc();
dbc.loadSync("IM_CSC_SensorCAN_v1.dbc");
const jsonData = dbc.toJson();

console.log("JSON dosyası oluşturuldu: dbc_data.json");



/////////////////////////////

// Display detail page for a specific files with sequelize, usage example

import Files from "../../../../models/files.js";
import CanMessageValueDescriptors from "../../../../models/can-message-value-descriptors.js";
import ValueDescriptors from "../../../../models/value-descriptors.js";
import Dbc from "dbc-can";
import fs from "fs";
import CanMessages from "../models/can-messages.js";
import CanDbcCollections from "../models/can-dbc-collections.js";

export default class LogsController {
  // Display detail page for a specific Files.
  static async detail(req, res) {
    try {
      const id = req.params.id;
      const entity = await CanDbcCollections.findOne({
        where: {
          id: id,
        },
        include: {
          model: Files,
          attributes: ["data"],
        },
        exclude: ["created_at", "updated_at", "deleted_at"],
        attributes: ["id"],
        limit: 100,
      });

      fs.writeFileSync("temp.dbc", entity.file.data);
      const dbc = new Dbc();

      dbc.loadSync("temp.dbc");
      const jsonData = dbc.toJson();

      if (jsonData !== null) {
        fs.writeFileSync("dbc_data.json", jsonData);
        const data = JSON.parse(jsonData);
        fs.unlinkSync("temp.dbc");
        let nameValueLength;
        let processedCount = 0;
        let index = 0;
        let messageId;
        let signalName;
        let length;
        let offset;
        let factor;
        let name;
        let byte_order;
        let max;
        let min;
        let is_signed;
        let start_bit;
        for (const key in data) {
          if (Object.hasOwnProperty.call(data, key)) {
            const item = data;
            try {
              for (const nameKey in item.valueTables) {
                if (processedCount >= nameValueLength) break;

                if (Object.hasOwnProperty.call(item.valueTables, nameKey)) {
                  const nameValues = item.valueTables[nameKey];
                  nameValueLength = nameValues.length;
                  item.messages.forEach((message) => {
                    name = message.name;
                    message.signals.forEach((signal) => {
                      if (signal.valueTable !== null) {
                        const id = message.id;
                        messageId = BigInt(id);
                        signalName = signal.name;
                        length = signal.length;
                        offset = signal.offset;
                        factor = signal.factor;
                        byte_order = signal.endian === "Motorola" ? 0 : 1;
                        is_signed = signal.signed ? 1 : 0;
                        start_bit = signal.startBit;
                        max = signal.max;
                        min = signal.min;
                      }
                    });
                  });
                  try {
                    for (const nameValue of nameValues) {
                      const ValueDescriptor = await ValueDescriptors.create({
                        name: nameValue,
                        value: index,
                      });

                      const canMessages = await CanMessages.findOne({
                        where: { can_id: messageId.toString() },
                      });
                      if (!canMessages) {
                        await CanMessages.create({
                          can_id: messageId.toString(),
                          can_dbc_collection_id: entity.id,
                          name: signalName,
                          signal_name: name,
                          start_bit: start_bit,
                          length: length,
                          factor: factor,
                          offset: offset,
                          byte_order: byte_order,
                          is_signed: is_signed,
                          min_value: min,
                          max_value: max,
                        });
                      }
                      const canMessageValueDescriptor =
                        await CanMessageValueDescriptors.findOne({
                          where: { can_message_id: canMessages.id },
                        });
                      if (!canMessageValueDescriptor) {
                        const CanMessageValueDescript =
                          await CanMessageValueDescriptors.create({
                            value_descriptor_id: ValueDescriptor.id,
                            can_message_id: canMessages.id,
                          });
                      }

                      processedCount++;
                      index++;
                      if (processedCount >= nameValueLength) break;
                    }
                  } catch (err) {
                    console.error("Error At Files Controller Detail:", err);
                  }
                }
              }
            } catch (err) {
              console.error("Error At Files Controller Detail:", err);
            }
          }
        }
      }

      res.send("Data added to table 'value_descriptors'");
    } catch (error) {
      res.status(403).send(error.message);
      console.error("Error At Files Controller Detail: " + error.message);
    }
  }
}
