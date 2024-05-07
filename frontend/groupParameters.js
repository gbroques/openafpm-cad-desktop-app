export default function groupParameters(form, parameters) {
    const valueByKey = mapValues(form, ({ value }) => value);
    const groupByKey = flattenToGroupByKey(parameters);
    const valueTransformer = value => isNaN(value) ? value : parseFloat(value);
    return createdNestedObject(valueByKey,
        key => groupByKey[key],
        valueTransformer);
}

function mapValues(obj, valueMapper) {
    return mapEntries(obj, ([key, value]) => (
        [key, valueMapper(value)]
    ));
}

function mapEntries(obj, entryMapper) {
    return Object.fromEntries(Object.entries(obj).map(entryMapper));
}

function flattenToGroupByKey(parameters) {
    const entries = Object.entries(parameters);
    return entries.reduce((acc, entry) => {
        const [group, valueByKey] = entry;
        const keys = Object.keys(valueByKey);
        const groupByKey = keys.reduce((obj, key) => {
            return { ...obj, [key]: group };
        }, {});
        return { ...acc, ...groupByKey };
    }, {});
}

function createdNestedObject(object, groupGetter, valueTransformer) {
    const entries = Object.entries(object);
    return entries.reduce((acc, entry) => {
        const [key, value] = entry;
        const group = groupGetter(key);
        if (group === undefined) {
            return acc;
        }
        if (acc[group] === undefined) {
            acc[group] = {};
        }
        acc[group][key] = valueTransformer(value);
        return acc;
    }, {});
}