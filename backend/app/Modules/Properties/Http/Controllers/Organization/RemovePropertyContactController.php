<?php

declare(strict_types=1);

namespace App\Modules\Properties\Http\Controllers\Organization;

use App\Modules\Properties\Actions\RemovePropertyContact;
use App\Modules\Properties\Queries\Properties;
use App\Modules\Properties\Queries\PropertyContacts;
use Illuminate\Http\Response;

final class RemovePropertyContactController
{
    public function __invoke(string $property, string $link, Properties $sites, PropertyContacts $contacts, RemovePropertyContact $retirer): Response
    {
        $retirer->handle($contacts->get($sites->get($property)->id, $link));

        return response()->noContent();
    }
}
