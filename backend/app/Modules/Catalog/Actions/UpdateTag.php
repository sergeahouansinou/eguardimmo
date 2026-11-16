<?php

declare(strict_types=1);

namespace App\Modules\Catalog\Actions;

use App\Modules\Catalog\Enums\ErrorCode;
use App\Modules\Catalog\Models\Tag;
use App\Modules\Catalog\Support\TagSlug;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;

final readonly class UpdateTag
{
    public function handle(Tag $etiquette, string $name, ?string $color): Tag
    {
        $slug = TagSlug::of($name);

        try {
            return DB::transaction(function () use ($etiquette, $name, $color, $slug): Tag {
                if (Tag::query()->where('slug', $slug)->whereKeyNot($etiquette->id)->exists()) {
                    throw ErrorCode::TagNameTaken->problem();
                }

                $etiquette->forceFill(['name' => $name, 'slug' => $slug, 'color' => $color])->save();

                return $etiquette;
            });
        } catch (UniqueConstraintViolationException) {
            throw ErrorCode::TagNameTaken->problem();
        }
    }
}
