<?php

declare(strict_types=1);

namespace App\Modules\Recovery\Http\Requests;

use App\Modules\Recovery\Support\ChoosesReceivables;
use Illuminate\Foundation\Http\FormRequest;

final class AddItemsRequest extends FormRequest
{
    use ChoosesReceivables;

    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, list<mixed>>
     */
    public function rules(): array
    {
        return $this->receivableRules();
    }
}
