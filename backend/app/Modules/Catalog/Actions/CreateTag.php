<?php

declare(strict_types=1);

namespace App\Modules\Catalog\Actions;

use App\Modules\Catalog\Enums\ErrorCode;
use App\Modules\Catalog\Models\Tag;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final readonly class CreateTag
{
    public function handle(string $name, ?string $color): Tag
    {
        $slug = Str::slug($name);

        return DB::transaction(function () use ($name, $color, $slug): Tag {
            if (Tag::query()->where('slug', $slug)->exists()) {
                throw ErrorCode::TagNameTaken->problem();
            }

            return Tag::query()->create(['name' => $name, 'slug' => $slug, 'color' => $color]);
        });
    }
}
