// Metro resolves image imports to an asset reference that expo-image accepts.
declare module '*.png' {
  const asset: number;
  export default asset;
}
