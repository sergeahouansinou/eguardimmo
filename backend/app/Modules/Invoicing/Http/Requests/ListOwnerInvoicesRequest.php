<?php

declare(strict_types=1);

namespace App\Modules\Invoicing\Http\Requests;

use App\Shared\Http\ListsForOwner;
use Illuminate\Foundation\Http\FormRequest;

final class ListOwnerInvoicesRequest extends FormRequest
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
        return $this->ownerRules(['id' => 'uuid']);
    }
}
