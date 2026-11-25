<?php

declare(strict_types=1);

namespace App\Modules\Listings\Http\Requests;

use App\Modules\Listings\Data\VisitRequestData;
use App\Modules\Listings\Support\PlainText;
use Illuminate\Foundation\Http\FormRequest;

final class StoreVisitRequestRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, list<mixed>>
     */
    public function rules(): array
    {
        return [
            'requested_slot' => PlainText::line(120, true),
            'message' => PlainText::text(1000),
        ];
    }

    public function toData(): VisitRequestData
    {
        $message = $this->filled('message') ? trim((string) $this->validated('message')) : null;

        return new VisitRequestData(trim((string) $this->validated('requested_slot')), $message === '' ? null : $message);
    }
}
