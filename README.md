# neural-amp-modeler-booster

## What does it do

This utility helps boosting the volume of a NAM profile after its creation. Useful to:
- improve profiles **that are too quiet**,
- or to have more consistency among profiles on devices that ignore the meta-data that would
  otherwise compensate the level.

## How does it work

This notebook applies a linear gain boost to Neural Amp Modeller (NAM) profile files by scaling 
the output layer weights directly.

## What is a NAM profile 

NAM (Neural Amp Modeler) has become _de facto_ the main standard when it comes to
open source guitar amp profiling technology; **profiling** is a technique where a guitar or
bass amplifier's behavior is "cloned" into a digital representation, by comparing the input 
signal and the amp's output (often with a "black box" approach when AI is involved), as opposed 
to the standard **modeling** approach where an amp is modeled bottom up, and every component
and interation is simulated to compose the whole. While profiles are not parametrized 
like models (at least not in the classical sense), their quality is absolutely incredible. 

## How to use

This little utility comes in **Jupyter Notebook** format, you can use it for example in
**Google Colab**.
