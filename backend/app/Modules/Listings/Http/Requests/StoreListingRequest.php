<?php

declare(strict_types=1);

namespace App\Modules\Listings\Http\Requests;

use App\Modules\Listings\Data\NewListingData;
use App\Modules\Listings\Enums\ListingCategory;
use App\Modules\Listings\Enums\ListingKind;
use App\Modules\Listings\Support\ListingRules;
use Illuminate\Foundation\Http\FormRequest;

final class StoreListingRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Ni `organization_id`, ni `status`, ni `public_ref`, ni `published_at`, ni `lock_version` : le serveur les fixe.
     *
     * @return array<string, list<mixed>>
     */
    public function rules(): array
    {
        return ListingRules::fields(true);
    }

    public function toData(): NewListingData
    {
        /** @var array<string, mixed> $v */
        $v = $this->validated();

        return new NewListingData(ListingKind::from((string) $v['kind']), ListingCategory::from((string) $v['category']), $v);
    }
}
