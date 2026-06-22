<?php

namespace App\Http\Controllers;

use App\Models\Lead;
use Carbon\Carbon;
use Illuminate\Http\Request;

class LeadController extends Controller
{
    public function contact(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'email' => ['required', 'email'],
            'phone' => ['nullable', 'string', 'max:20'],
            'orderNumber' => ['nullable', 'string', 'max:40'],
            'category' => ['required', 'string', 'max:30'],
            'subject' => ['nullable', 'string', 'max:255'],
            'message' => ['required', 'string', 'min:20'],
        ]);

        $now = Carbon::now('UTC');
        $lead = new Lead(array_merge($data, [
            'type' => 'contact',
            'status' => 'new',
            'notes' => '',
        ]));
        $lead->createdAt = $now;
        $lead->updatedAt = $now;
        $lead->save();

        return $this->ok($lead, null, 201);
    }

    public function newsletter(Request $request)
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
        ]);

        $now = Carbon::now('UTC');
        $lead = new Lead([
            'type' => 'newsletter',
            'email' => $data['email'],
            'name' => null,
            'phone' => null,
            'orderNumber' => null,
            'category' => null,
            'subject' => null,
            'message' => null,
            'status' => 'subscribed',
        ]);
        $lead->createdAt = $now;
        $lead->updatedAt = $now;
        $lead->save();

        return $this->ok($lead, null, 201);
    }
}
