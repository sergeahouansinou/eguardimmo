<?php

declare(strict_types=1);

namespace App\Modules\Leases\Http\Requests;

use App\Shared\Http\ListsForOwner;
use Illuminate\Foundation\Http\FormRequest;

final class ListOwnerLeasesRequest extends FormRequest
{
    use ListsForOwner;

    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, list<mixed>>
     */
    public function rules(): array
    {
        return $this->ownerRules(['starts_on' => 'date_format:Y-m-d,Y-m-d H:i:s', 'id' => 'uuid']);
    }
}
