import {
	Dancing_Script,
	Allura,
	Alex_Brush,
	Parisienne,
	Dynalight,
	Great_Vibes,
	Grape_Nuts,
	Gloria_Hallelujah
} from 'next/font/google'

export const dancingScript = Dancing_Script({
	subsets: ['latin'],
	weight: '400'
})

export const allura = Allura({
	subsets: ['latin'],
	weight: '400'
})

export const alexBrush = Alex_Brush({
	subsets: ['latin'],
	weight: '400'
})

export const parisienne = Parisienne({
	subsets: ['latin'],
	weight: '400'
})


export const dynalight = Dynalight({
	subsets: ['latin'],
	weight: '400'
})


export const greatVibes = Great_Vibes({
	subsets: ['latin'],
	weight: '400'
})


export const grapeNuts = Grape_Nuts({
	subsets: ['latin'],
	weight: '400'
})


export const gloriaHalleluja = Gloria_Hallelujah({
	subsets: ['latin'],
	weight: '400'
})

export const fontFamilyMap: Record<string, string> = {
	'Dancing Script': dancingScript.className,
	'Allura': allura.className,
	'Alex Brush': alexBrush.className,
	'Parisienne': parisienne.className,
	'Dynalight': dynalight.className,
	'Great Vibes': greatVibes.className,
	'Grape Nuts': grapeNuts.className,
	'Gloria Hallelujah': gloriaHalleluja.className,
};