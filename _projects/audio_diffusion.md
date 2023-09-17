---
layout: page
title: Diffusion Models for Audios 
# description: These apps aim to help Anganwadi users, Child Development Project Officers and other field level implementers to record, calculate, analyse and/or organize data related to children malnourishment and Body Mass Index.
img: assets/img/audio_diffusion/card.jpg
importance: 1
category: Artificial Intelligence
related_publications: audiodiffusion
---

Diffusion models have been extensively used for various computer vision tasks such as image denoising, super-resolution, and inpainting. Due to their ability to model complex data distributions, researchers have started exploring their potential for audio generation tasks.
In this work, we propose two novel diffusion models for audio generation: the cross-diffusion and the double-diffusion. Our models are designed to be memory and speed efficient, which makes them suitable for real-time applications.

Cross-diffusion technique allows for conditional generation of high-quality audio without compromising on the output quality. We evaluated the effectiveness of this technique for instrument style transfer and generating background music for a given piece of lyrical vocal audio. The double-diffusion technique, on the other hand, is designed to produce an unconditional paired set of instrumental sounds for chorus generation. In both techniques, models for each instrument can be trained independently unlike the existing conditional diffusion models. We have also analyzed the effect of different hyperparameters on the performance of the model.

The experimental results show that the proposed models are comparable in terms of perceptual quality of the generated audio when compared to the existing models while being significantly simple in terms of architecture and having lower memory and computational requirements.

While cross-diffusion has the potential to be used for various applications like music production and sound design, double-diffusion can offer creative starting points for music producers.