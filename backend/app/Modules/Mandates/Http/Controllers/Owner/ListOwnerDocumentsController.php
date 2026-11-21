<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Http\Controllers\Owner;

use App\Modules\Identity\Models\User;
use App\Modules\Mandates\Http\Requests\ListOwnerDocumentsRequest;
use App\Modules\Mandates\Http\Resources\Owner\OwnerDocumentPageResource;
use App\Modules\Mandates\PublicApi\MandateDirectory;
use App\Modules\Mandates\Queries\OwnerDocuments;
use App\Modules\Mandates\Queries\OwnerDocumentViews;

final class ListOwnerDocumentsController
{
    public function __invoke(ListOwnerDocumentsRequest $request, MandateDirectory $repertoire, OwnerDocuments $documents, OwnerDocumentViews $vues): OwnerDocumentPageResource
    {
        /** @var User $user */
        $user = $request->user();
        $portee = $repertoire->ownerScope($user->id, $request->agency());
        $page = $documents->page($portee, $request->perPage(), $request->cursor());

        return new OwnerDocumentPageResource($page, $vues->of($portee, $page->items()));
    }
}
