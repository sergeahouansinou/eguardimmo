<?php

declare(strict_types=1);

namespace App\Modules\Properties\Http\Controllers\Organization;

use App\Modules\Properties\Actions\AddPropertyContact;
use App\Modules\Properties\Http\Requests\AddPropertyContactRequest;
use App\Modules\Properties\Http\Resources\PropertyContactResource;
use App\Modules\Properties\Queries\Properties;
use App\Modules\Properties\Queries\PropertyContacts;
use Illuminate\Http\JsonResponse;

final class AddPropertyContactController
{
    public function __invoke(string $property, AddPropertyContactRequest $request, Properties $sites, AddPropertyContact $ajouter, PropertyContacts $contacts): JsonResponse
    {
        $lien = $ajouter->handle($sites->get($property), $request->partyId(), $request->unitId(), $request->categoryId());

        return (new PropertyContactResource($contacts->one($lien)))->response()->setStatusCode(201);
    }
}
