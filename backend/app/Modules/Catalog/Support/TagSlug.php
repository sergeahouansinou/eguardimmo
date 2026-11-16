<?php

declare(strict_types=1);

namespace App\Modules\Catalog\Support;

use Illuminate\Support\Str;

final class TagSlug
{
    /**
     * Un nom sans équivalent latin donne un slug vide : l'empreinte du nom le remplace, et deux noms identiques restent en conflit.
     */
    public static function of(string $name): string
    {
        $slug = Str::slug($name);

        return $slug !== '' ? $slug : 't-'.substr(hash('sha256', mb_strtolower(trim($name))), 0, 16);
    }
}
