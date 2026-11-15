<?php

declare(strict_types=1);

namespace App\Modules\Catalog\Http\Controllers\Organization;

use App\Modules\Catalog\Actions\DeleteTag;
use App\Modules\Catalog\Queries\Tags;
use Illuminate\Http\Response;

final class DeleteTagController
{
    public function __invoke(string $tag, Tags $etiquettes, DeleteTag $supprimer): Response
    {
        $supprimer->handle($etiquettes->get($tag));

        return response()->noContent();
    }
}
