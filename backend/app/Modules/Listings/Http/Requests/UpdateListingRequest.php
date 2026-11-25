<?php

declare(strict_types=1);

namespace App\Modules\Listings\Http\Requests;

use App\Modules\Listings\Data\ListingChangesData;
use App\Modules\Listings\Support\ListingRules;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Arr;

final class UpdateListingRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Le type de l'annonce ne change pas : il fixe l'unité de prix et les règles de réservation.
     *
     * @return array<string, list<mixed>>
     */
    public function rules(): array
    {
        return ['lock_version' => ['required', 'integer', 'min:1'], ...ListingRules::fields(false)];
    }

    public function toData(): ListingChangesData
    {
        /** @var array<string, mixed> $v */
        $v = $this->validated();

        return new ListingChangesData((int) $v['lock_version'], Arr::except($v, ['lock_version']));
    }
}
