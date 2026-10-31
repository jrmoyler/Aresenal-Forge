"""Finish the Forge's 100 periodic PBR sample sets from their authored 512px maps.

Run with a source and destination materials directory. Preserve packed AO and
metal masks exactly; create coherent albedo, roughness and tangent-normal details.
"""
import argparse
from functools import lru_cache
from pathlib import Path

import numpy as np
from PIL import Image

TAU = np.float32(2 * np.pi)


def noise(x, y, cells_x, cells_y, rng):
    """Smooth periodic lattice noise; shared across the boundaries of a UV tile."""
    grid = rng.uniform(-1, 1, (cells_y, cells_x)).astype(np.float32)
    sx, sy = x * cells_x, y * cells_y
    ix, iy = sx.astype(int), sy.astype(int)
    fx, fy = sx - ix, sy - iy
    fx, fy = fx*fx*(3-2*fx), fy*fy*(3-2*fy)
    a = grid[iy % cells_y, ix % cells_x] * (1-fx) + grid[iy % cells_y, (ix+1) % cells_x] * fx
    b = grid[(iy+1) % cells_y, ix % cells_x] * (1-fx) + grid[(iy+1) % cells_y, (ix+1) % cells_x] * fx
    return a*(1-fy)+b*fy


@lru_cache(maxsize=16)
def relief(index, n):
    family = (index-1) % 10
    rng = np.random.default_rng(3209 * index)
    axis = (np.arange(n, dtype=np.float32)+.5)/n
    x, y = axis[None, :], axis[:, None]
    broad = noise(x, y, 5, 5, rng)
    fine = noise(x, y, 112, 112, rng)
    if family == 0:  # Interrupted abrasive tracks on forged steel.
        height = np.minimum(noise(x, y, 5, 190, rng)+.28, 0) * (.7+.3*broad)
    elif family == 1:  # Gas pores and casting sand.
        height = .22*fine - np.maximum(noise(x, y, 56, 56, rng)-.53, 0)*1.8
    elif family == 2:  # Fine peening within the existing broad hammer facets.
        height = .34*noise(x, y, 74, 61, rng)+.17*noise(x, y, 6, 143, rng)
    elif family == 3:  # Longitudinal oak vessels with intermittent ray flecks.
        height = np.minimum(noise(x, y, 158, 14, rng)+.12, 0) + .14*noise(x, y, 8, 72, rng)
    elif family == 4:  # Open leather follicles set into the original pebbled hide.
        height = .17*fine - np.maximum(noise(x, y, 108, 108, rng)-.38, 0)*1.4
    elif family == 5:  # Retain the orientation of the warp/weft on each crossover.
        count = 48 + ((index-1)//10 % 3)*8
        twist_x = np.sin(TAU*(x*count*2 + y*count + broad*.12))
        twist_y = np.sin(TAU*(y*count*2 - x*count + broad*.12))
        cover = .5+.5*np.sin(TAU*x*count)*np.sin(TAU*y*count)
        height = .32*(cover*twist_x+(1-cover)*twist_y)
    elif family == 6:  # Fine mica platelet striations.
        height = .35*fine + .23*noise(x, y, 81, 28, rng)
    elif family == 7:  # Very shallow planar striae on polished cleavage faces.
        height = .19*noise(x, y, 133, 9, rng) + .12*noise(x, y, 8, 91, rng)
    elif family == 8:  # Sparse pinholes and gentle orange peel below the glaze.
        height = .1*fine - np.maximum(noise(x, y, 88, 88, rng)-.64, 0)*1.4
    else:  # Pitted volcanic glass with a finer crystalline matrix.
        height = .32*fine - np.maximum(noise(x, y, 55, 55, rng)-.28, 0)*.92
    return height


def encode(values):
    return np.uint8(np.clip(np.rint(values), 0, 255))


def refine_channel(image, role, height):
    values = np.asarray(image, dtype=np.float32)
    if role == 'baseColor':
        return encode(values * (1 + height[..., None]*.085))
    if role == 'orm':
        values[..., 1] = np.clip(values[..., 1]-height*23, 0, 255)
        return encode(values)
    normal = values/127.5-1
    z = np.maximum(normal[..., 2], .05)
    normal[..., 0] -= z*(np.roll(height, -1, 1)-np.roll(height, 1, 1))*.32
    normal[..., 1] += z*(np.roll(height, -1, 0)-np.roll(height, 1, 0))*.32
    normal /= np.maximum(np.linalg.norm(normal, axis=2, keepdims=True), .001)
    return encode((normal+1)*127.5)


def upgrade(source, destination, index):
    source, destination = Path(source), Path(destination)
    destination.mkdir(parents=True, exist_ok=True)
    for name in ['baseColor', 'orm', 'normal']:
        with Image.open(source/(name+'.png')) as im:
            if im.size != (512, 512) or im.mode != 'RGB':
                raise ValueError(f'Expected authored 512px RGB maps at {source}')
            values = refine_channel(im, name, relief(index, im.width))
        Image.fromarray(values).save(destination/(name+'.png'), compress_level=6)


if __name__ == '__main__':
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument('source', type=Path)
    cli.add_argument('destination', type=Path)
    args = cli.parse_args()
    for index in range(1, 101):
        directory = f'{index:03}'
        upgrade(args.source/directory, args.destination/directory, index)
