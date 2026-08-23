export type TeCuentoInterfaceCopy = {
  experienceLabel: string
  logoTitle: string
  logoCreditPrefix: string
  panInstructions: string
  panoramaLabel: string
  stageLabel: string
  authorMark: string
  clueLayerLabel: string
  introKicker: string
  introTitle: string
  introDescription: string
  introInstructions: string[]
  introEnterLabel: string
  readerCloseLabel: string
  readerRegionLabel: string
  soundOnLabel: string
  soundOffLabel: string
  soundRetryLabel: string
  creditsTriggerLabel: string
  creditsCloseLabel: string
  runtimeError: string
}
export type TeCuentoMakingOfScene = {
  id: string
  heading: string
  paragraphs: string[]
  image: {
    src: string
    alt: string
    caption: string
    width: number
    height: number
    fit: "contain" | "cover"
  }
}

export type TeCuentoCreditsContent = {
  title: string
  historyHeading: string
  historyParagraphs: string[]
  makingOfScenes: TeCuentoMakingOfScene[]
  periodLabel: string
  periodStart: string
  periodEnd: string
  musicHeading: string
  musicBody: string
  socialHeading: string
}

export type TeCuentoDeployment = {
  content: {
    title: string
    serverContext: string
    inLanguage: string
    interfaceCopy: TeCuentoInterfaceCopy
    credits: TeCuentoCreditsContent
  }
  identity: {
    brandName: string
    brandUrl: string
  }
  socialLinks: Array<{
    href: string
    label: string
  }>
}
