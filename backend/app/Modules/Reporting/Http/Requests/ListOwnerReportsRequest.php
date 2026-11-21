<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Http\Requests;

use App\Shared\Http\ListsForOwner;
use Illuminate\Foundation\Http\FormRequest;

final class ListOwnerReportsRequest extends FormRequest
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
        return $this->ownerRules(['period_start' => 'date_format:Y-m-d,Y-m-d H:i:s', 'id' => 'uuid']);
    }
}
