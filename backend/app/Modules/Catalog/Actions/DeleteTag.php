<?php

declare(strict_types=1);

namespace App\Modules\Catalog\Actions;

use App\Modules\Catalog\Models\Tag;
use App\Modules\Catalog\Models\Tagging;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\DB;

final readonly class DeleteTag
{
    public function __construct(private RecordAudit $audit) {}

    public function handle(Tag $etiquette): void
    {
        DB::transaction(function () use ($etiquette): void {
            $retirees = Tagging::query()->where('tag_id', $etiquette->id)->delete();

            $this->audit->handle('catalog.tag.untagged', subject: $etiquette, metadata: ['taggings' => $retirees]);

            $etiquette->delete();
        });
    }
}
