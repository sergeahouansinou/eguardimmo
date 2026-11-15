<?php

declare(strict_types=1);

namespace App\Modules\Catalog;

use App\Modules\Catalog\Models\CustomFieldDefinition;
use App\Modules\Catalog\Models\Tag;
use App\Modules\Catalog\Models\Tagging;
use App\Modules\Catalog\Models\Term;
use App\Modules\Catalog\Models\TermOverride;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Support\ServiceProvider;

final class CatalogServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        Relation::enforceMorphMap([
            'term' => Term::class,
            'term_override' => TermOverride::class,
            'custom_field_definition' => CustomFieldDefinition::class,
            'tag' => Tag::class,
            'tagging' => Tagging::class,
        ]);
    }
}
