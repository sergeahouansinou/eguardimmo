<?php

declare(strict_types=1);

namespace App\Modules\Catalog\Actions;

use App\Modules\Catalog\Enums\ErrorCode;
use App\Modules\Catalog\Models\Tag;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final readonly class UpdateTag
{
    public function handle(Tag $etiquette, string $name, ?string $color): Tag
    {
        $slug = Str::slug($name);

        return DB::transaction(function () use ($etiquette, $name, $color, $slug): Tag {
            if (Tag::query()->where('slug', $slug)->whereKeyNot($etiquette->id)->exists()) {
                throw ErrorCode::TagNameTaken->problem();
            }

            $etiquette->forceFill(['name' => $name, 'slug' => $slug, 'color' => $color])->save();

            return $etiquette;
        });
    }
}
